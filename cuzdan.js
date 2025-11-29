const { ethers } = require("ethers");

// Rastgele, yepyeni bir cüzdan oluştur
const wallet = ethers.Wallet.createRandom();

console.log("------------------------------------------------");
console.log("🎉 Cüzdanın Hazır!");
console.log(`📜 Adres (Bunu herkese verebilirsin): ${wallet.address}`);
console.log(`🔑 Private Key (Bunu SAKIN kimseye verme!): ${wallet.privateKey}`);
console.log("------------------------------------------------");
console.log("UYARI: Bu bir test cüzdanıdır. Gerçek para için kullanma.");
