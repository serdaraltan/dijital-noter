const express = require('express');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const { ethers } = require("ethers");
const PDFDocument = require('pdfkit');
const qr = require('qr-image');

const app = express();
const upload = multer({ dest: 'uploads/' });

// --- GÜVENLİK ---
// Private Key SADECE Render kasasından okunur.
const PRIVATE_KEY = process.env.PRIVATE_KEY; 
const PROVIDER_URL = process.env.RPC_URL || "https://polygon-rpc.com/";
const PORT = process.env.PORT || 3001;

// --- FONKSİYONLAR ---
function calculateHash(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

async function stampToBlockchain(hash) {
    if (!PRIVATE_KEY) throw new Error("Private Key Missing");
    const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const feeData = await provider.getFeeData();
    const tx = await wallet.sendTransaction({
        to: wallet.address,
        value: 0,
        data: '0x' + hash,
        gasPrice: feeData.gasPrice 
    });
    await tx.wait();
    return tx.hash;
}

// --- HTML ARAYÜZÜ ---
const htmlTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MyFileSeal | Blockchain Notary</title>
    <meta name="description" content="Secure your documents on Polygon Blockchain.">
    <style>
        :root { --primary: #3b82f6; --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --text-muted: #94a3b8; --success: #34d399; }
        body { margin: 0; font-family: 'Inter', system-ui, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
        .container { max-width: 800px; margin: 0 auto; padding: 2rem 1rem; }
        #loadingOverlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.95); z-index: 9999; justify-content: center; align-items: center; flex-direction: column; text-align: center; }
        .spinner { width: 60px; height: 60px; border: 6px solid #334155; border-top: 6px solid var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1.5rem; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .header { text-align: center; margin-bottom: 3rem; padding-top: 2rem; }
        .logo { font-size: 2.2rem; font-weight: 800; background: linear-gradient(90deg, #60a5fa, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .subtitle { color: var(--text-muted); font-size: 1.1rem; max-width: 600px; margin: 1rem auto; }
        .card { background: var(--card); padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid #334155; text-align: center; }
        .upload-area { border: 2px dashed #475569; border-radius: 0.75rem; padding: 3rem 1.5rem; transition: 0.3s; cursor: pointer; position: relative; background: rgba(15, 23, 42, 0.3); }
        .upload-area:hover { border-color: var(--primary); background: rgba(59, 130, 246, 0.1); }
        .upload-area.file-selected { border-color: var(--success); background: rgba(52, 211, 153, 0.1); }
        input[type="file"] { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
        button.cta { background: var(--primary); color: white; border: none; padding: 1rem 2rem; border-radius: 0.5rem; font-size: 1.1rem; font-weight: 600; margin-top: 1.5rem; cursor: pointer; width: 100%; transition: 0.2s; }
        button.cta:hover { background: #2563eb; transform: translateY(-2px); }
        button.download-btn { background: #f59e0b; color: #fff; margin-top: 1rem; }
        button.download-btn:hover { background: #d97706; }
        .hash-display { background: #020617; padding: 1rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.85rem; color: #cbd5e1; word-break: break-all; border: 1px solid #475569; margin: 0.5rem 0; }
        .success-badge { display: inline-block; padding: 0.25rem 1rem; background: #065f46; color: #34d399; border-radius: 99px; font-weight: 600; font-size: 0.9rem; margin-bottom: 1rem; }
        .section-title { margin-top: 4rem; font-size: 1.5rem; border-bottom: 1px solid #334155; padding-bottom: 0.5rem; margin-bottom: 1.5rem; color: #e2e8f0; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; }
        .info-box { background: rgba(30, 41, 59, 0.5); padding: 1.5rem; border-radius: 0.75rem; border: 1px solid #334155; }
        .info-box h3 { margin-top: 0; color: var(--primary); font-size: 1.1rem; }
        .faq-item { margin-bottom: 1.5rem; }
        .faq-question { font-weight: 600; color: #e2e8f0; margin-bottom: 0.25rem; }
        .faq-answer { color: var(--text-muted); font-size: 0.95rem; }
        footer { text-align: center; margin-top: 4rem; color: #475569; font-size: 0.85rem; padding-bottom: 2rem; }
        a { color: var(--primary); text-decoration: none; }
    </style>
    <script>
        function updateFileName(input) {
            const label = document.getElementById('file-label');
            const icon = document.getElementById('upload-icon');
            const box = document.getElementById('upload-box');
            if (input.files && input.files.length > 0) {
                const fileName = input.files[0].name;
                label.innerHTML = '<span style="color:var(--success); font-weight:bold">✅ Selected:</span><br>' + fileName;
                icon.innerHTML = '📄';
                box.classList.add('file-selected');
            }
        }
        function showLoading() {
            const input = document.querySelector('input[type="file"]');
            if (input.files.length > 0) {
                document.getElementById('loadingOverlay').style.display = 'flex';
            }
        }
    </script>
</head>
<body>
    <div id="loadingOverlay">
        <div class="spinner"></div>
        <h2 style="color: white; margin:0;">Sealing Document...</h2>
        <p style="color: #94a3b8; margin-top:1rem;">Calculating Hash & Writing to Blockchain.</p>
    </div>

    <div class="container">
        <div class="header">
            <div class="logo">MyFileSeal</div>
            <p class="subtitle">Timestamp your documents on the Blockchain. <br>Immutable proof of existence for creators, freelancers, and businesses.</p>
        </div>

        ${content}

        <div class="how-it-works">
            <h2 class="section-title">How It Works</h2>
            <div class="grid">
                <div class="info-box"><h3>1. Upload</h3><p>Select any file. We calculate its unique digital fingerprint (Hash) locally.</p></div>
                <div class="info-box"><h3>2. Timestamp</h3><p>We send this fingerprint to the Polygon Blockchain. Your file remains private.</p></div>
                <div class="info-box"><h3>3. Proof</h3><p>You get a permanent blockchain link and a PDF certificate proving your ownership.</p></div>
            </div>
        </div>

        <div class="faq">
            <h2 class="section-title">Frequently Asked Questions</h2>
            <div class="faq-item">
                <div class="faq-question">Do you store my files?</div>
                <div class="faq-answer">No. Never. We only calculate the "Hash" (fingerprint) on our server and delete the file immediately. Your secrets are safe.</div>
            </div>
            <div class="faq-item">
                <div class="faq-question">Is this legally binding?</div>
                <div class="faq-answer">It serves as strong digital evidence (Proof of Existence) in courts worldwide, verifying that data existed at a point in time.</div>
            </div>
            <div class="faq-item">
                <div class="faq-question">What does "Free" mean?</div>
                <div class="faq-answer">Currently, MyFileSeal is in Beta. We cover the blockchain transaction fees (Gas) for you. Enjoy!</div>
            </div>
        </div>

        <footer>&copy; 2025 MyFileSeal. Powered by Polygon Network.</footer>
    </div>
</body>
</html>
`;

app.get('/', (req, res) => {
    res.send(htmlTemplate(`
        <div class="card">
            <form action="/seal" method="post" enctype="multipart/form-data" onsubmit="showLoading()">
                <div class="upload-area" id="upload-box">
                    <span class="upload-icon" id="upload-icon">📂</span>
                    <h3 id="file-label">Drag & Drop or Click to Upload</h3>
                    <p style="color:var(--text-muted); font-size:0.9rem">Max size: 10MB.</p>
                    <input type="file" name="document" required onchange="updateFileName(this)">
                </div>
                <button type="submit" class="cta">🔒 Seal on Blockchain (Free)</button>
            </form>
        </div>
    `));
});

app.post('/seal', upload.single('document'), async (req, res) => {
    try {
        if (!req.file) return res.send(htmlTemplate(`<h3>❌ No file selected.</h3><a href='/'>Go Back</a>`));
        const originalName = req.file.originalname;
        const hash = calculateHash(req.file.path);
        const txHash = await stampToBlockchain(hash);
        fs.unlinkSync(req.file.path);

        const scanUrl = `https://polygonscan.com/tx/${txHash}`;
        const pdfLink = `/certificate?hash=${hash}&tx=${txHash}&name=${encodeURIComponent(originalName)}`;

        res.send(htmlTemplate(`
            <div class="card" style="text-align:left">
                <div style="text-align:center">
                    <div class="success-badge">✅ SUCCESS</div>
                    <h2>Sealed on Blockchain!</h2>
                </div>
                <div style="margin-top:2rem">
                    <label style="font-weight:bold; color:var(--primary); font-size:0.8rem">DIGITAL FINGERPRINT:</label>
                    <div class="hash-display">${hash}</div>
                </div>
                <div style="text-align:center; margin-top:2rem; display:flex; flex-direction:column; gap:1rem;">
                    <a href="${pdfLink}" target="_blank">
                        <button class="cta" style="background: #f59e0b;">📄 Download Premium Certificate (PDF)</button>
                    </a>
                    <a href="${scanUrl}" target="_blank">
                        <button class="cta" style="background:#334155; font-size:1rem;">🔗 View on PolygonScan</button>
                    </a>
                </div>
                <div style="text-align:center; margin-top:1.5rem"><a href="/" style="color:var(--text-muted)">Seal Another File</a></div>
            </div>
        `));
    } catch (error) {
        console.error(error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.send(htmlTemplate(`<h2 style="color:#ef4444">❌ Error: ${error.message}</h2><a href="/">Try Again</a>`));
    }
});

// --- FİNAL PDF TASARIMI ---
app.get('/certificate', (req, res) => {
    const { hash, tx, name } = req.query;
    if(!hash || !tx) return res.send("Missing data.");

    // autoFirstPage: false (Sayfa kontrolü bizde olsun)
    const doc = new PDFDocument({ margin: 50, size: 'A4' }); 
    const fileName = name || "Document";

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Certificate.pdf`);
    doc.pipe(res);

    // ÇERÇEVELERİ BİRAZ KÜÇÜLTELİM Kİ TAŞMASIN (Safe Zone)
    // A4 Yükseklik: ~841 px. Biz 780'e kadar sınır çizelim.
    doc.rect(20, 20, 555, 780).lineWidth(3).strokeColor('#C5A059').stroke(); // Altın
    doc.rect(25, 25, 545, 770).lineWidth(1).strokeColor('#000000').stroke(); // Siyah

    // BAŞLIK
    doc.moveDown(2);
    doc.font('Helvetica-Bold').fontSize(30).fillColor('#1a1a1a').text('CERTIFICATE', { align: 'center' });
    doc.fontSize(12).fillColor('#C5A059').text('OF BLOCKCHAIN TIMESTAMP', { align: 'center', characterSpacing: 2 });
    
    doc.moveDown(2);

    // ORTALANMIŞ AÇIKLAMA (Koordinatlı yerleşim)
    // Sayfanın merkezi ~297. 400 genişlik verirsek sol kenar ~97 olur.
    doc.fontSize(12).font('Helvetica').fillColor('#444444')
       .text('This certifies that the digital asset identified below has been permanently anchored to the Polygon Mainnet Blockchain, providing immutable proof of existence at the recorded date.', 
       97, doc.y, { align: 'center', width: 400 });

    doc.moveDown(3);

    // MAVİ KUTU VE DETAYLAR
    const startY = doc.y;
    doc.rect(50, startY, 495, 160).fillOpacity(0.05).fill('#3b82f6');
    doc.fillOpacity(1);

    doc.y = startY + 20;
    
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a1a1a').text('FILE NAME:', 70);
    doc.font('Helvetica').fontSize(12).text(fileName);
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').fontSize(10).text('TIMESTAMP DATE:');
    doc.font('Helvetica').fontSize(12).text(new Date().toUTCString());
    doc.moveDown(0.5);

    doc.font('Helvetica-Bold').fontSize(10).text('CRYPTOGRAPHIC FINGERPRINT (SHA-256):');
    doc.font('Courier').fontSize(10).fillColor('#333333').text(hash, { width: 450 });
    
    // Transaction ID
    doc.y = startY + 180;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text('TRANSACTION ID (TX):', 50);
    doc.fontSize(9).fillColor('#3b82f6')
       .text(tx, { link: `https://polygonscan.com/tx/${tx}`, underline: true });

    // --- ALT KISIM (FOOTER BÖLGESİ) ---
    // Manuel Y koordinatları ile sabitleyelim.
    
    // 1. SOL: MÜHÜR (Y: 660)
    const sealY = 660;
    doc.circle(100, sealY + 40, 40).lineWidth(2).strokeColor('#3b82f6').stroke(); // Dış
    doc.circle(100, sealY + 40, 35).lineWidth(1).strokeColor('#3b82f6').stroke(); // İç
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#3b82f6').text('BLOCKCHAIN', 65, sealY + 25);
    doc.text('VERIFIED', 75, sealY + 38);
    doc.fontSize(8).text('SECURE', 83, sealY + 52);

    // 2. ORTA: MYFILESEAL LOGOSU (İstediğin Yer)
    // Mühür ve QR kodun tam ortasına, tıklanabilir logo.
    const logoY = sealY + 25; 
    doc.fontSize(16).fillColor('#3b82f6').text('MyFileSeal', 250, logoY, {
        align: 'center',
        link: 'https://www.myfileseal.com',
        underline: false
    });
    doc.fontSize(8).fillColor('#94a3b8').text('Digital Notary Service', 250, logoY + 20, { align: 'center' });

    // 3. SAĞ: QR KOD (Y: 660)
    const qrSvg = qr.imageSync(`https://polygonscan.com/tx/${tx}`, { type: 'png' });
    doc.image(qrSvg, 450, sealY, { width: 80 });
    doc.fontSize(8).fillColor('black').text('SCAN TO VERIFY', 450, sealY + 85, { width: 80, align: 'center' });

    // 4. FOOTER YAZISI (EN ALTTA, ÇERÇEVE İÇİNDE)
    // Çerçeve 780'de bitiyor. Yazıyı 760'a koyarsak garanti içinde kalır.
    doc.fontSize(9).fillColor('grey').text('Powered by MyFileSeal.com - Immutable Proof on Polygon Network', 0, 760, {
        align: 'center',
        width: 595 // Sayfa genişliği kadar
    });

    doc.end();
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
