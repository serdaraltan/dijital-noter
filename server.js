const express = require('express');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const { ethers } = require("ethers");
const PDFDocument = require('pdfkit'); // PDF oluşturucu

const app = express();
const upload = multer({ dest: 'uploads/' });

// --- GÜVENLİK VE AYARLAR ---
// ÖNCE GÜVENLİK: Şifreler Render kasasından okunur.
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
    if (!PRIVATE_KEY) throw new Error("Wallet Private Key is missing!");
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

// --- HTML TASARIMI ---
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
        
        /* Loading Overlay */
        #loadingOverlay {
            display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(15, 23, 42, 0.95); z-index: 9999;
            justify-content: center; align-items: center; flex-direction: column; text-align: center;
        }
        .spinner {
            width: 60px; height: 60px; border: 6px solid #334155;
            border-top: 6px solid var(--primary); border-radius: 50%;
            animation: spin 1s linear infinite; margin-bottom: 1.5rem;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* General Styles */
        .header { text-align: center; margin-bottom: 3rem; padding-top: 2rem; }
        .logo { font-size: 2.2rem; font-weight: 800; background: linear-gradient(90deg, #60a5fa, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .subtitle { color: var(--text-muted); font-size: 1.1rem; max-width: 600px; margin: 1rem auto; }
        .card { background: var(--card); padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 30px rgba(0,0,0,0.5); border: 1px solid #334155; text-align: center; }
        
        /* Upload Area */
        .upload-area { border: 2px dashed #475569; border-radius: 0.75rem; padding: 3rem 1.5rem; transition: 0.3s; cursor: pointer; position: relative; background: rgba(15, 23, 42, 0.3); }
        .upload-area:hover { border-color: var(--primary); background: rgba(59, 130, 246, 0.1); }
        .upload-area.file-selected { border-color: var(--success); background: rgba(52, 211, 153, 0.1); }
        input[type="file"] { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
        
        /* Buttons */
        button.cta { background: var(--primary); color: white; border: none; padding: 1rem 2rem; border-radius: 0.5rem; font-size: 1.1rem; font-weight: 600; margin-top: 1.5rem; cursor: pointer; width: 100%; transition: 0.2s; }
        button.cta:hover { background: #2563eb; transform: translateY(-2px); }
        button.download-btn { background: #f59e0b; color: #fff; margin-top: 1rem; }
        button.download-btn:hover { background: #d97706; }

        /* Other */
        .hash-display { background: #020617; padding: 1rem; border-radius: 0.5rem; font-family: monospace; font-size: 0.85rem; color: #cbd5e1; word-break: break-all; border: 1px solid #475569; margin: 0.5rem 0; }
        .success-badge { display: inline-block; padding: 0.25rem 1rem; background: #065f46; color: #34d399; border-radius: 99px; font-weight: 600; font-size: 0.9rem; margin-bottom: 1rem; }
        
        /* Sections */
        .section-title { margin-top: 4rem; font-size: 1.5rem; border-bottom: 1px solid #334155; padding-bottom: 0.5rem; margin-bottom: 1.5rem; color: #e2e8f0; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem; }
        .info-box { background: rgba(30, 41, 59, 0.5); padding: 1.5rem; border-radius: 0.75rem; border: 1px solid #334155; }
        .info-box h3 { margin-top: 0; color: var(--primary); font-size: 1.1rem; }
        
        footer { text-align: center; margin-top: 4rem; color: #475569; font-size: 0.85rem; }
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
        <h2 style="color: white; margin:0;">Sealing Your Document...</h2>
        <p style="color: #94a3b8; margin-top:1rem;">Calculating Hash & Writing to Polygon Blockchain.<br>Please wait (~15 seconds).</p>
    </div>

    <div class="container">
        <div class="header">
            <div class="logo">MyFileSeal</div>
            <p class="subtitle">Timestamp your documents on the Blockchain. Immutable proof.</p>
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
            <h2 class="section-title">FAQ</h2>
            <div style="margin-bottom:1rem"><strong>Do you store my files?</strong><br><span style="color:var(--text-muted)">No. We only store the math (Hash). Your secrets are safe.</span></div>
            <div style="margin-bottom:1rem"><strong>Is this legally binding?</strong><br><span style="color:var(--text-muted)">It serves as strong digital evidence (Proof of Existence).</span></div>
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
        
        const hash = calculateHash(req.file.path);
        const txHash = await stampToBlockchain(hash);
        fs.unlinkSync(req.file.path);

        const scanUrl = `https://polygonscan.com/tx/${txHash}`;
        
        // PDF İndirme Linki (Hash ve TxHash'i parametre olarak gönderiyoruz)
        const pdfLink = `/certificate?hash=${hash}&tx=${txHash}`;

        res.send(htmlTemplate(`
            <div class="card" style="text-align:left">
                <div style="text-align:center">
                    <div class="success-badge">✅ SUCCESS</div>
                    <h2>Sealed on Blockchain!</h2>
                </div>
                
                <div style="margin-top:2rem">
                    <label style="font-weight:bold; color:var(--primary); font-size:0.8rem">DIGITAL FINGERPRINT (HASH):</label>
                    <div class="hash-display">${hash}</div>
                </div>

                <div style="text-align:center; margin-top:2rem; display:flex; flex-direction:column; gap:1rem;">
                    <a href="${pdfLink}" target="_blank">
                        <button class="cta download-btn">📄 Download PDF Certificate</button>
                    </a>
                    
                    <a href="${scanUrl}" target="_blank">
                        <button class="cta" style="background:#334155; font-size:1rem;">🔗 View on PolygonScan</button>
                    </a>
                </div>

                <div class="info-box" style="margin-top:2rem; border-color:var(--success)">
                    <h3 style="color:var(--success)">What do I do now?</h3>
                    <ul style="padding-left:1.2rem; margin:0; font-size:0.9rem; color:#e2e8f0">
                        <li><strong>Download the PDF:</strong> This is your official record. Keep it safe.</li>
                        <li><strong>Save your file:</strong> Keep the original file. Do not change it.</li>
                        <li><strong>Verify anytime:</strong> Use the Hash to prove the file existed at this date.</li>
                    </ul>
                </div>
                
                <div style="text-align:center; margin-top:1.5rem">
                    <a href="/" style="color:var(--text-muted); font-size:0.9rem">Seal Another File</a>
                </div>
            </div>
        `));
    } catch (error) {
        console.error(error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.send(htmlTemplate(`<h2 style="color:#ef4444">❌ Error: ${error.message}</h2><a href="/">Try Again</a>`));
    }
});

// --- PDF OLUŞTURMA ROTASI ---
app.get('/certificate', (req, res) => {
    const { hash, tx } = req.query;
    if(!hash || !tx) return res.send("Missing data.");

    const doc = new PDFDocument();
    
    // PDF Header Ayarları
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Certificate-${hash.substring(0,8)}.pdf`);
    doc.pipe(res);

    // PDF İçeriği
    doc.fontSize(25).fillColor('#3b82f6').text('MyFileSeal', { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).fillColor('black').text('Digital Authenticity Certificate', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(12).text('This document certifies that the file with the following digital fingerprint was permanently recorded on the Polygon Blockchain.', { align: 'justify' });
    doc.moveDown(2);
    
    doc.fontSize(10).fillColor('grey').text('DIGITAL FINGERPRINT (SHA-256 HASH):');
    doc.fontSize(12).font('Courier').fillColor('black').text(hash);
    doc.moveDown();
    
    doc.fontSize(10).font('Helvetica').fillColor('grey').text('BLOCKCHAIN TRANSACTION ID (TX):');
    doc.fontSize(10).fillColor('blue').text(tx, { link: `https://polygonscan.com/tx/${tx}`, underline: true });
    doc.moveDown(2);
    
    doc.fontSize(12).fillColor('black').text('What does this mean?');
    doc.fontSize(10).text('This certificate proves that this specific file existed at the time of the blockchain transaction. The data is immutable and decentralized.');
    doc.moveDown();
    
    doc.fontSize(10).text('Date: ' + new Date().toUTCString());
    doc.moveDown(4);
    
    doc.fontSize(10).fillColor('grey').text('Powered by MyFileSeal & Polygon Network', { align: 'center' });
    
    doc.end();
});

app.listen(PORT, () => {
    console.log(`MyFileSeal running on port ${PORT}`);
});
