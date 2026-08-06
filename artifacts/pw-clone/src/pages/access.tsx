import { generateAndRedirect } from "@/lib/access-key";

const AROLINKS_URL = "https://arolinks.com/vSDzpK"; // set in your Arolinks dashboard, destination = /verify

export default function AccessPage() {
  return (
    <div className="access-page">
      <h2>Get 24-Hour Access</h2>
      <p>Generate a key and complete the steps to unlock the site.</p>
      <button onClick={() => generateAndRedirect(AROLINKS_URL)}>
        Generate Key
      </button>
    </div>
  );
}
