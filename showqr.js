const { execSync } = require('child_process');
try { execSync('npm install qrcode-terminal', { stdio: 'inherit', cwd: __dirname }); } catch(e) {}
const qrcode = require('qrcode-terminal');
qrcode.generate('exp://192.168.178.38:8081', { small: true }, function(qr) {
  console.log('\n\n  PadelVision - QR Code\n');
  console.log(qr);
  console.log('  Scanne mit Expo Go\n\n');
});
