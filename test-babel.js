const babel = require('@babel/core');
const fs = require('fs');
const code = fs.readFileSync('artifacts/pw-clone/src/components/DrmPlayer.tsx', 'utf8');
try {
  babel.transformSync(code, {
    filename: 'DrmPlayer.tsx',
    presets: ['@babel/preset-typescript', '@babel/preset-react']
  });
  console.log("Babel parse successful");
} catch(e) {
  console.error(e.message);
}
