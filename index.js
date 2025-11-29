const fs = require('fs');
const crypto = require('crypto');

const dosyaAdi = 'deneme.txt';

function dosyaHashle(dosyaYolu) {
    const hash = crypto.createHash('sha256');
    const input = fs.createReadStream(dosyaYolu);

    input.on('readable', () => {
        const data = input.read();
        if (data)
            hash.update(data);
    });

    input.on('end', () => {
        const sonuc = hash.digest('hex');
        console.log('------------------------------------------------');
        console.log(`📂 Dosya: ${dosyaAdi}`);
        console.log(`🔒 Hash (Parmak İzi): ${sonuc}`);
        console.log('------------------------------------------------');
    });

    input.on('error', (err) => {
        console.error('Hata oluştu:', err.message);
    });
}

// BU SATIRI İPTAL ETTİK Kİ DEĞİŞİKLİKLERİ GÖREBİLELİM:
// fs.writeFileSync(dosyaAdi, 'Bu dosyanın içeriği değişirse hash değişir!');

dosyaHashle(dosyaAdi);
