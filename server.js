const express = require('express');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const { ethers } = require("ethers");
const PDFDocument = require('pdfkit');
const qr = require('qr-image');
const axios = require('axios');

const app = express();
const upload = multer({ dest: 'uploads/' });

// --- GÜVENLİK AYARLARI ---
const PRIVATE_KEY = process.env.PRIVATE_KEY; 
const PROVIDER_URL = process.env.RPC_URL || "https://polygon-rpc.com/";
const PORT = process.env.PORT || 3001;

// Admin Ayarları
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const ETHERSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY;
const WALLET_ADDRESS = PRIVATE_KEY ? new ethers.Wallet(PRIVATE_KEY).address : "";

// --- MIDDLEWARE: Admin Auth ---
function checkAuth(req, res, next) {
    const auth = { login: ADMIN_USER, password: ADMIN_PASS };
    const b64auth = (req.headers.authorization || '').split(' ')[1] || '';
    const [login, password] = Buffer.from(b64auth, 'base64').toString().split(':');
    if (login && password && login === auth.login && password === auth.password) return next();
    res.set('WWW-Authenticate', 'Basic realm="Admin Area"');
    res.status(401).send('Authentication required.');
}

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

// --- HTML ŞABLONU (YENİLENMİŞ UI) ---
const htmlTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MyFileSeal | Blockchain Notary</title>
    <meta name="description" content="Secure your documents on Polygon Blockchain.">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🛡️</text></svg>">
    
    <style>
        :root { --primary: #3b82f6; --primary-hover: #2563eb; --bg: #0f172a; --card: #1e293b; --text: #f8fafc; --text-muted: #94a3b8; --success: #34d399; --border: #334155; }
        body { margin: 0; font-family: 'Inter', system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
        .container { max-width: 900px; margin: 0 auto; padding: 2rem 1rem; }
        
        /* Loading Overlay */
        #loadingOverlay { display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.95); z-index: 9999; justify-content: center; align-items: center; flex-direction: column; text-align: center; }
        .spinner { width: 60px; height: 60px; border: 6px solid var(--border); border-top: 6px solid var(--primary); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 1.5rem; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* Header & Logo */
        .navbar { display: flex; justify-content: center; align-items: center; padding: 2rem 0 3rem 0; flex-direction: column; }
        .logo-container { display: flex; align-items: center; gap: 10px; margin-bottom: 0.5rem; }
        .logo-svg { width: 40px; height: 40px; fill: var(--primary); }
        .logo-text { font-size: 2rem; font-weight: 800; letter-spacing: -1px; background: linear-gradient(90deg, #60a5fa, #a78bfa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .subtitle { color: var(--text-muted); font-size: 1.1rem; text-align: center; }

        /* Main Card */
        .card { background: var(--card); padding: 3rem; border-radius: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border: 1px solid var(--border); text-align: center; margin-bottom: 4rem; }
        
        /* Upload Area */
        .upload-area { border: 2px dashed var(--border); border-radius: 1rem; padding: 3rem; transition: 0.3s; cursor: pointer; position: relative; background: rgba(15, 23, 42, 0.3); }
        .upload-area:hover { border-color: var(--primary); background: rgba(59, 130, 246, 0.05); }
        .upload-area.file-selected { border-color: var(--success); background: rgba(52, 211, 153, 0.05); }
        input[type="file"] { position: absolute; top: 0; left: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer; }
        
        /* Buttons */
        button.cta { background: var(--primary); color: white; border: none; padding: 1.2rem 2.5rem; border-radius: 0.75rem; font-size: 1.1rem; font-weight: 700; margin-top: 2rem; cursor: pointer; width: 100%; transition: 0.2s; box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.3); }
        button.cta:hover { background: var(--primary-hover); transform: translateY(-2px); box-shadow: 0 10px 15px -3px rgba(59, 130, 246, 0.4); }
        button.download-btn { background: #f59e0b; color: #fff; margin-top: 1rem; }
        button.download-btn:hover { background: #d97706; }

        /* Grid Layout for Info & FAQ */
        .section-title { font-size: 1.5rem; color: #e2e8f0; margin-bottom: 2rem; display: flex; align-items: center; gap: 10px; }
        .section-title::before { content: ''; display: block; width: 5px; height: 25px; background: var(--primary); border-radius: 2px; }
        
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 4rem; }
        
        .info-box { background: rgba(30, 41, 59, 0.4); padding: 1.5rem; border-radius: 1rem; border: 1px solid var(--border); transition: 0.2s; }
        .info-box:hover { border-color: var(--primary); transform: translateY(-5px); }
        .info-box h3 { margin-top: 0; color: var(--primary); font-size: 1.2rem; display: flex; align-items: center; gap: 10px; }
        .info-box p { color: var(--text-muted); font-size: 0.95rem; line-height: 1.6; margin-bottom: 0; }

        /* Result Styles */
        .hash-display { background: #020617; padding: 1.2rem; border-radius: 0.5rem; font-family: 'Courier New', monospace; font-size: 0.9rem; color: #cbd5e1; word-break: break-all; border: 1px solid var(--border); margin: 1rem 0; }
        .success-badge { display: inline-flex; align-items: center; gap: 8px; padding: 0.5rem 1.5rem; background: rgba(6, 95, 70, 0.5); color: #34d399; border-radius: 99px; font-weight: 700; font-size: 0.9rem; margin-bottom: 1.5rem; border: 1px solid #065f46; }

        footer { text-align: center; margin-top: 4rem; color: #475569; font-size: 0.9rem; padding: 2rem 0; border-top: 1px solid var(--border); }
        a { color: var(--primary); text-decoration: none; font-weight: 500; }
        a:hover { text-decoration: underline; }
    </style>
    <script>
        function updateFileName(input) {
            const label = document.getElementById('file-label');
            const icon = document.getElementById('upload-icon');
            const box = document.getElementById('upload-box');
            if (input.files && input.files.length > 0) {
                const fileName = input.files[0].name;
                label.innerHTML = '<span style="color:var(--success); font-weight:bold">✅ Ready to Seal:</span><br>' + fileName;
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
        <h2 style="color: white; margin:0;">Processing...</h2>
        <p style="color: #94a3b8; margin-top:1rem;">Calculating cryptographic proof &<br>Writing to Polygon Mainnet.</p>
    </div>

    <div class="container">
        <div class="navbar">
            <div class="logo-container">
                <svg class="logo-svg" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.67-3.13 8.96-7 10.15-3.87-1.19-7-5.48-7-10.15V6.3l7-3.12z"/>
                    <path d="M10 7h4v2h-4V7zm0 4h4v2h-4v-2zm0 4h4v2h-4v-2z" fill="#0f172a"/> 
                </svg>
                <div class="logo-text">MyFileSeal</div>
            </div>
            <div class="subtitle">Secure Blockchain Timestamping Service</div>
        </div>

        ${content}

        <h2 class="section-title">How It Works</h2>
        <div class="grid">
            <div class="info-box">
                <h3>📤 1. Upload</h3>
                <p>Select any document, image, or file. We locally calculate its unique SHA-256 digital fingerprint (Hash).</p>
            </div>
            <div class="info-box">
                <h3>⛓️ 2. Timestamp</h3>
                <p>We anchor this unique fingerprint to the Polygon Blockchain. Your actual file never leaves your privacy.</p>
            </div>
            <div class="info-box">
                <h3>📜 3. Certificate</h3>
                <p>You receive a downloadable PDF certificate and a permanent blockchain link proving your ownership.</p>
            </div>
        </div>

        <h2 class="section-title">Frequently Asked Questions</h2>
        <div class="grid">
            <div class="info-box">
                <h3>🔒 Do you store my files?</h3>
                <p><strong>No. Never.</strong> We only process the cryptographic hash. Your original file content remains private and secure on your device.</p>
            </div>
            <div class="info-box">
                <h3>⚖️ Is this legally binding?</h3>
                <p>It acts as strong "Proof of Existence" (PoE). It technically proves that a specific file existed at a specific point in time.</p>
            </div>
            <div class="info-box">
                <h3>💰 Why is it free?</h3>
                <p>We are currently in Beta. We cover the small Polygon network gas fees to help users experience blockchain security.</p>
            </div>
            <div class="info-box">
                <h3>✏️ Can I edit the file?</h3>
                <p>No. Changing even a single pixel or comma will change the Hash, breaking the proof. Keep your original file safe.</p>
            </div>
        </div>

        <footer>
            &copy; 2025 MyFileSeal. All rights reserved.<br>
            <span style="opacity:0.5; font-size:0.8rem">Powered by Polygon Network & Node.js</span>
        </footer>
    </div>
</body>
</html>
`;

app.get('/', (req, res) => {
    res.send(htmlTemplate(`
        <div class="card">
            <form action="/seal" method="post" enctype="multipart/form-data" onsubmit="showLoading()">
                <div class="upload-area" id="upload-box">
                    <span class="upload-icon" id="upload-icon" style="font-size:3rem">📂</span>
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
            <div class="card" style="text-align:left; padding:2rem;">
                <div style="text-align:center">
                    <div class="success-badge">✅ PROOF CREATED</div>
                    <h2 style="margin-bottom:0.5rem">Your File is Sealed Forever!</h2>
                    <p style="color:var(--text-muted); margin-bottom:2rem">The digital fingerprint has been permanently recorded.</p>
                </div>
                
                <label style="font-weight:bold; color:var(--primary); font-size:0.8rem; letter-spacing:1px;">DIGITAL FINGERPRINT (HASH)</label>
                <div class="hash-display">${hash}</div>

                <div style="display:grid; gap:1rem; margin-top:2rem;">
                    <a href="${pdfLink}" target="_blank" style="text-decoration:none">
                        <button class="cta" style="background: #f59e0b; margin-top:0;">📄 Download Premium Certificate (PDF)</button>
                    </a>
                    
                    <a href="${scanUrl}" target="_blank" style="text-decoration:none">
                        <button class="cta" style="background:var(--card); border:1px solid var(--border); margin-top:0;">🔗 Verify on PolygonScan</button>
                    </a>
                </div>
                
                <div style="text-align:center; margin-top:2rem">
                    <a href="/" style="color:var(--text-muted)">← Seal Another File</a>
                </div>
            </div>
        `));
    } catch (error) {
        console.error(error);
        if (req.file) fs.unlinkSync(req.file.path);
        res.send(htmlTemplate(`<div class="card"><h2 style="color:#ef4444">❌ Error</h2><p>${error.message}</p><a href="/" class="cta" style="background:#334155; display:inline-block; margin-top:1rem; text-decoration:none;">Try Again</a></div>`));
    }
});

// --- ADMIN PANELİ ---
app.get('/admin', checkAuth, async (req, res) => {
    try {
        const provider = new ethers.JsonRpcProvider(PROVIDER_URL);
        const balanceWei = await provider.getBalance(WALLET_ADDRESS);
        const balance = ethers.formatEther(balanceWei);

        const apiUrl = `https://api.etherscan.io/v2/api?chainid=137&module=account&action=txlist&address=${WALLET_ADDRESS}&startblock=0&endblock=99999999&sort=desc&apikey=${ETHERSCAN_API_KEY}`;
        const response = await axios.get(apiUrl);
        const transactions = response.data.result;

        let tableRows = '';
        if (Array.isArray(transactions)) {
            transactions.forEach(tx => {
                if(tx.from.toLowerCase() === WALLET_ADDRESS.toLowerCase()) {
                    const date = new Date(tx.timeStamp * 1000).toLocaleString('tr-TR');
                    const gasCost = ethers.formatEther(BigInt(tx.gasUsed) * BigInt(tx.gasPrice));
                    const status = tx.isError === '0' ? '<span style="color:#34d399">Success</span>' : '<span style="color:red">Fail</span>';
                    tableRows += `<tr><td>${date}</td><td><a href="https://polygonscan.com/tx/${tx.hash}" target="_blank" style="color:#3b82f6">View</a></td><td>${status}</td><td>${parseFloat(gasCost).toFixed(6)}</td></tr>`;
                }
            });
        }

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head><title>CEO Dashboard</title><style>body{background:#0f172a;color:#f8fafc;font-family:sans-serif;padding:2rem}.card{background:#1e293b;padding:1.5rem;border-radius:0.5rem;margin-bottom:1rem;border:1px solid #334155}table{width:100%;border-collapse:collapse;margin-top:1rem}th,td{text-align:left;padding:0.8rem;border-bottom:1px solid #334155}a{color:#3b82f6}</style></head>
            <body>
                <h1>🚀 CEO Dashboard</h1>
                <div class="card"><h3>Balance</h3><h1>${parseFloat(balance).toFixed(4)} POL</h1><small>${WALLET_ADDRESS}</small></div>
                <div class="card"><h3>Transactions</h3><table><thead><tr><th>Date</th><th>Link</th><th>Status</th><th>Cost</th></tr></thead><tbody>${tableRows}</tbody></table></div>
                <a href="/">Back to Site</a>
            </body></html>
        `);
    } catch (error) { res.send(`Error: ${error.message}`); }
});

// --- PDF SERTİFİKA ---
app.get('/certificate', (req, res) => {
    const { hash, tx, name } = req.query;
    if(!hash || !tx) return res.send("Missing data.");
    const doc = new PDFDocument({ margin: 50, size: 'A4' }); 
    const fileName = name || "Document";
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Certificate.pdf`);
    doc.pipe(res);

    doc.rect(20, 20, 555, 780).lineWidth(3).strokeColor('#C5A059').stroke(); 
    doc.rect(25, 25, 545, 770).lineWidth(1).strokeColor('#000000').stroke(); 

    doc.moveDown(2);
    doc.font('Helvetica-Bold').fontSize(30).fillColor('#1a1a1a').text('CERTIFICATE', { align: 'center' });
    doc.fontSize(12).fillColor('#C5A059').text('OF BLOCKCHAIN TIMESTAMP', { align: 'center', characterSpacing: 2 });
    doc.moveDown(2);
    doc.fontSize(12).font('Helvetica').fillColor('#444444').text('This certifies that the digital asset identified below has been permanently anchored to the Polygon Mainnet Blockchain, providing immutable proof of existence at the recorded date.', 97, doc.y, { align: 'center', width: 400 });
    doc.moveDown(3);

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
    
    doc.y = startY + 180;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text('TRANSACTION ID (TX):', 50);
    doc.fontSize(9).fillColor('#3b82f6').text(tx, { link: `https://polygonscan.com/tx/${tx}`, underline: true });

    const sealY = 660;
    doc.circle(100, sealY + 40, 40).lineWidth(2).strokeColor('#3b82f6').stroke();
    doc.circle(100, sealY + 40, 35).lineWidth(1).strokeColor('#3b82f6').stroke();
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#3b82f6').text('BLOCKCHAIN', 65, sealY + 25);
    doc.text('VERIFIED', 75, sealY + 38);
    doc.fontSize(8).text('SECURE', 83, sealY + 52);

    const logoY = sealY + 25; 
    doc.fontSize(16).fillColor('#3b82f6').text('MyFileSeal', 250, logoY, { align: 'center', link: 'https://www.myfileseal.com', underline: false });
    doc.fontSize(8).fillColor('#94a3b8').text('Digital Notary Service', 250, logoY + 20, { align: 'center' });

    const qrSvg = qr.imageSync(`https://polygonscan.com/tx/${tx}`, { type: 'png' });
    doc.image(qrSvg, 450, sealY, { width: 80 });
    doc.fontSize(8).fillColor('black').text('SCAN TO VERIFY', 450, sealY + 85, { width: 80, align: 'center' });

    doc.fontSize(9).fillColor('grey').text('Powered by MyFileSeal.com - Immutable Proof on Polygon Network', 0, 760, { align: 'center', width: 595 });
    doc.end();
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
