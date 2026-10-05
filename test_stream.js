const https = require('https');
const url = "https://m.pwmarco.site/api/stream-url?parentId=69919d4755afdfb898bb08d8&subjectId=5f709c351b999704b83cca8a&childId=6a92a8e9f8a5bee26380bbc2&urlType=penpencilvdo&videoId=6a92a8e9f8a5bee26380bbc2&topicId=6a1c73e4f3a4e59dc8373b0e";

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        let json = JSON.parse(data);
        let e = json.d;
        let i = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let t = e.indexOf(".");
        let r = e.slice(0, t);
        let n = function(e) {
            let t = e.replace(/[^A-Za-z0-9+/]/g, ""), r = [];
            for (let e = 0; e < t.length; e += 4) {
                let n = i.indexOf(t[e]), o = i.indexOf(t[e + 1]), a = i.indexOf(t[e + 2]), c = i.indexOf(t[e + 3]);
                r.push(n << 2 | o >> 4);
                if (a >= 0) r.push((15 & o) << 4 | a >> 2);
                if (c >= 0) r.push((3 & a) << 6 | c);
            }
            return r;
        }(e.slice(t + 1));
        n.reverse();
        let o = function(e, t) {
            let r = 0x811c9dc5;
            for (let t = 0; t < e.length; t++) {
                r ^= e.charCodeAt(t);
                r = Math.imul(r, 0x1000193) >>> 0;
            }
            let n = r || 0x9e3779b9, o = [];
            for (let e = 0; e < t; e++) {
                n ^= n << 13; n >>>= 0; n ^= n >>> 17; n ^= n << 5;
                o.push(255 & (n >>>= 0));
            }
            return o;
        }("p9Wm4rc0::sEaLv1" + r, n.length);
        let decodedStr = function(e) {
            let t = "";
            for (let r of e) t += String.fromCharCode(r);
            return decodeURIComponent(t.replace(/[\s\S]/g, e => {
                let t = e.charCodeAt(0).toString(16).padStart(2, "0");
                return "%".concat(t);
            }));
        }(n.map((e, t) => (e ^ o[t]) & 255));
        
        console.log(JSON.stringify(JSON.parse(decodedStr), null, 2));
    });
});
