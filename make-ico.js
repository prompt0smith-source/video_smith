const mod = require('png-to-ico');
const pngToIco = mod.default || mod;
const fs = require('fs');
Promise.resolve(pngToIco('Icon.png')).then((buf) => {
  fs.writeFileSync('Icon.ico', buf);
  console.log('ok');
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
