export interface DownloadProgress {
  total: number;
  downloaded: number;
  status: "idle" | "fetching_manifest" | "fetching_key" | "downloading" | "muxing" | "done" | "error";
  error?: string;
}

export class HLSDownloader {
  private url: string;
  private uuid: string;
  private onProgress: (progress: DownloadProgress) => void;
  private cancelled = false;

  constructor(url: string, uuid: string, onProgress: (progress: DownloadProgress) => void) {
    this.url = url;
    this.uuid = uuid;
    this.onProgress = onProgress;
  }

  public cancel() {
    this.cancelled = true;
  }

  public async start(filename: string = "video.mp4", quality: number | null = null) {
    try {
      this.updateProgress(0, 0, "fetching_manifest");
      
      // 1. Fetch master playlist to get best quality (or use specified quality)
      let playlistUrl = "";
      if (this.url.includes("streama.pimaxer.in")) {
        const uuidMatch = this.url.match(/streama\.pimaxer\.in\/([0-9a-fA-F\-]+)\//) || this.url.match(/\/proxy\/streama\.pimaxer\.in\/([0-9a-fA-F\-]+)\//);
        if (uuidMatch) {
          const uuid = uuidMatch[1];
          const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
          playlistUrl = isLocalhost
            ? `https://streama.pimaxer.in/${uuid}/hls/${quality || 720}/main.m3u8`
            : `/proxy/streama.pimaxer.in/${uuid}/hls/${quality || 720}/main.m3u8`;
        } else {
          playlistUrl = this.url;
        }
      } else {
        const baseUrl = this.url.substring(0, this.url.lastIndexOf("/"));
        playlistUrl = quality ? `${baseUrl}/hls/${quality}/main.m3u8` : `${baseUrl}/hls/720/main.m3u8`;
      }
      
      let playlistRes = await fetch(playlistUrl);
      if (!playlistRes.ok) {
        // Fallback to whatever URL was passed
        playlistUrl = this.url;
        playlistRes = await fetch(playlistUrl);
      }

      if (this.cancelled) return;
      const playlistText = await playlistRes.text();

      // 2. Parse segments and key
      const lines = playlistText.split("\n");
      const segments: string[] = [];
      let keyUrl = "";
      let ivHex = "";

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("#EXT-X-KEY:")) {
          const uriMatch = line.match(/URI="([^"]+)"/);
          if (uriMatch) keyUrl = uriMatch[1];
          const ivMatch = line.match(/IV=0x([a-fA-F0-9]+)/);
          if (ivMatch) ivHex = ivMatch[1];
        } else if (line && !line.startsWith("#")) {
          // It's a segment
          segments.push(line);
        }
      }

      if (segments.length === 0) throw new Error("No video segments found in playlist.");
      if (this.cancelled) return;

      // 3. Fetch decryption key if needed
      let cryptoKey: CryptoKey | null = null;
      let ivBytes: Uint8Array | null = null;

      if (keyUrl) {
        this.updateProgress(segments.length, 0, "fetching_key");
        // Rewrite key URL just like in DrmPlayer
        let finalKeyUrl = keyUrl;
        if (keyUrl.includes(".key")) {
          const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
          finalKeyUrl = isLocalhost
            ? `https://streama.pimaxer.in/${this.uuid}/hls-key?videoKey=${this.uuid}&key=enc.key`
            : `/proxy/streama.pimaxer.in/${this.uuid}/hls-key?videoKey=${this.uuid}&key=enc.key`;
        }

        const keyRes = await fetch(finalKeyUrl);
        if (!keyRes.ok) throw new Error("Failed to fetch decryption key.");
        const keyBuffer = await keyRes.arrayBuffer();

        // Import key for Web Crypto
        cryptoKey = await window.crypto.subtle.importKey(
          "raw",
          keyBuffer,
          { name: "AES-CBC" },
          false,
          ["decrypt"]
        );

        if (ivHex) {
          ivBytes = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
        }
      }

      // 4. Download and decrypt segments
      this.updateProgress(segments.length, 0, "downloading");
      
      const chunks: Blob[] = [];
      let seqNum = 1; // Default IV if not specified

      for (let i = 0; i < segments.length; i++) {
        if (this.cancelled) return;
        
        let segUrl = segments[i];
        try {
          segUrl = new URL(segUrl, playlistUrl).href;
        } catch (e) {
          if (!segUrl.startsWith("http")) {
            const urlBase = playlistUrl.substring(0, playlistUrl.lastIndexOf("/") + 1);
            segUrl = urlBase + segUrl.replace(/^\//, "");
          }
        }

        // Retry logic for segment
        let segBuffer: ArrayBuffer | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const segRes = await fetch(segUrl);
            if (!segRes.ok) throw new Error(`Segment ${i} failed`);
            segBuffer = await segRes.arrayBuffer();
            break;
          } catch (e) {
            if (attempt === 2) throw e;
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        if (!segBuffer) throw new Error("Failed to download segment " + i);
        if (this.cancelled) return;

        // Decrypt if necessary
        if (cryptoKey) {
          // If IV wasn't in playlist, it's the sequence number padded to 16 bytes
          let iv = ivBytes;
          if (!iv) {
            iv = new Uint8Array(16);
            const view = new DataView(iv.buffer);
            view.setUint32(12, seqNum, false); // sequence number is big-endian in last 4 bytes
            seqNum++;
          }

          const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-CBC", iv: iv as any },
            cryptoKey,
            segBuffer
          );
          chunks.push(new Blob([decrypted], { type: "video/mp2t" }));
        } else {
          chunks.push(new Blob([segBuffer], { type: "video/mp2t" }));
        }

        this.updateProgress(segments.length, i + 1, "downloading");
      }

      if (this.cancelled) return;
      this.updateProgress(segments.length, segments.length, "muxing");

      // 5. Combine and download
      // Note: We are concatenating TS segments into a single file and saving as .mp4
      // While it's technically a TS container, most modern players (VLC, etc) can play it perfectly.
      const finalBlob = new Blob(chunks, { type: "video/mp4" });
      const downloadUrl = URL.createObjectURL(finalBlob);
      
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename.endsWith(".mp4") ? filename : `${filename}.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      this.updateProgress(segments.length, segments.length, "done");
    } catch (err: any) {
      if (this.cancelled) return;
      this.updateProgress(0, 0, "error", err.message || "Unknown error");
    }
  }

  private updateProgress(total: number, downloaded: number, status: DownloadProgress["status"], error?: string) {
    this.onProgress({ total, downloaded, status, error });
  }
}
