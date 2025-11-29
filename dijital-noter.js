const { ethers } = require("ethers");
const fs = require('fs');
const crypto = require('crypto');

// --- AYARLAR ---
// BURAYA DİKKAT: cuzdan.js'den aldığın Private Key'i tırnak içine yapıştır.
const PRIVATE_KEY = "0xb5dc9e82563aa7f44295af9d8f0e49fa28cc984d595d1d6abb0cca6409bf29f8"; 
const DOSYA_ADI = 'deneme.txt';

// --- ADIM 1: Dosyanın Hash'ini Hesapla ---
function hashHesapla(dosya) {
    const fileBuffer = fs.readFileSync(dosya);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

async function notereKaydet() {
    console.log("⏳ İşlem başlıyor...");

    // 1. Hash'i al
    const dosyaHash = hashHesapla(DOSYA_ADI);
    console.log(`📄 Dosya Hash'i: ${dosyaHash}`);

    // 2. Blockchain'e Bağlan
    const provider = new ethers.JsonRpcProvider("https://rpc-amoy.polygon.technology/");
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log("📡 Blockchain'e bağlanıldı. Mühür basılıyor...");

    // 3. İşlemi Hazırla ve Gönder
    // Blockchain hexadecimal (0x ile başlayan) veri sever. Hash'in başına 0x ekliyoruz.
    const tx = await wallet.sendTransaction({
        to: wallet.address, // Kendimize gönderiyoruz
        value: 0,           // Para göndermiyoruz
        data: '0x' + dosyaHash // İŞTE BÜTÜN SIR BURADA! Hash'i not düşüyoruz.
    });

    console.log("🚀 İşlem ağa gönderildi! Onay bekleniyor...");

    // 4. Onayı Bekle
    await tx.wait();

    console.log("------------------------------------------------");
    console.log("✅ TEBRİKLER! DOSYA BLOCKCHAIN'E KAZINDI!");
    console.log(`🔗 Kanıt Linki (TX Hash): https://amoy.polygonscan.com/tx/${tx.hash}`);
    console.log("------------------------------------------------");
}

notereKaydet().catch((error) => {
    console.error("❌ Hata:", error.message);
});
