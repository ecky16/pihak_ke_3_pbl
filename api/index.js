const axios = require('axios');
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHANNEL_ID = '-1003759185457';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxeAkZl8kgM9KYATer4C53fb3LsUuwa__RE7fpdDnkXOz6nR2TTsH2F8_LjvBUyOTCEwQ/exec';
const WEB_APP_URL = 'https://pihak-ke-3-pbl.vercel.app/gamas.html'; // GANTI DENGAN URL WEB APP MAS

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(200).send('OK');
    const { message, edited_message } = req.body;
    const msg = message || edited_message;
    if (!msg) return res.status(200).send('OK');

    const chatId = msg.chat.id.toString();
    const text = msg.text || "";

    try {
        // 1. CEK WHITELIST
        const checkUser = await axios.post(GAS_URL, { chatId: chatId, action: 'check_user' });
        if (checkUser.data.status === 'unauthorized') {
            return res.status(200).json({
                method: 'sendMessage', chat_id: chatId,
                text: "⚠️ **Akses Ditolak!**\n\nID Anda (" + chatId + ") tidak terdaftar."
            });
        }

        // 2. MENU START / KEMBALI
        if (text === '/start' || text === 'Kembali') {
            return res.status(200).json({
                method: 'sendMessage', chat_id: chatId,
                text: `Selamat Datang Mas Ecky!\n\nKlik **🚀 MULAI SURVEY** untuk monitoring.\nKlik **⚠️ LAPOR GAMAS** untuk input data sejarah gangguan.`,
                reply_markup: {
                    keyboard: [
                        [{ text: "🚀 MULAI SURVEY", request_location: true }],
                        [{ text: "⚠️ LAPOR GAMAS", web_app: { url: WEB_APP_URL } }],
                        [{ text: "🏁 SELESAI" }]
                    ],
                    resize_keyboard: true
                }, parse_mode: 'Markdown'
            });
        }

        // 3. INSTRUKSI KIRIM FOTO
        if (text === '📸 KIRIM LAPORAN FOTO') {
            return res.status(200).json({
                method: 'sendMessage', chat_id: chatId,
                text: '📸 **INSTRUKSI FOTO TEMUAN:**\n\n1. Klik ikon 📎 (**Klip Kertas**) di pojok kanan bawah.\n2. Pilih ikon 📸 (**Kamera**) untuk jepret langsung.\n3. **PENTING:** Jangan kirim foto dari Galeri!\n\n*Silakan kirim fotonya sekarang...*',
                parse_mode: 'Markdown'
            });
        }

        // 4. TERIMA LOKASI
        if (msg.location) {
            axios.post(GAS_URL, { 
                chatId, lat: msg.location.latitude, lon: msg.location.longitude, 
                action: message ? 'start_survey' : 'tracking' 
            }).catch(e => console.error(e.message));
            
            if (message) {
                return res.status(200).json({
                    method: 'sendMessage', chat_id: chatId,
                    text: `✅ **Survey Aktif!**\n\n**PENTING:** Klik ikon 📎 (Paperclip) > Location > **Share My Live Location for 8 Hours**.\n\n*Foto baru bisa dikirim SETELAH Live Location aktif.*`,
                    reply_markup: { keyboard: [[{ text: "📸 KIRIM LAPORAN FOTO" }], [{ text: "🏁 SELESAI" }]], resize_keyboard: true },
                    parse_mode: 'Markdown'
                });
            }
            return res.status(200).send('OK');
        }

        // 5. TERIMA FOTO (SATPAM LIVE)
        if (msg.photo) {
            const statusRes = await axios.post(GAS_URL, { chatId, action: 'check_status_detail' });
            if (statusRes.data.status === 'WAIT_LIVE') {
                return res.status(200).json({ 
                    method: 'sendMessage', chat_id: chatId, 
                    text: '🚫 **Foto Ditolak!**\n\nAktifkan **Live Location** dulu mas.' 
                });
            }
            const photoId = msg.photo[msg.photo.length - 1].file_id;
            const processPhoto = async () => {
                try {
                    const forward = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, { 
                        chat_id: CHANNEL_ID, photo: photoId, caption: `Laporan dari ID: ${chatId}` 
                    });
                    const photoUrl = `https://t.me/c/${CHANNEL_ID.replace('-100','')}/${forward.data.result.message_id}`;
                    await axios.post(GAS_URL, { chatId, foto: photoUrl, action: 'temp_photo' });
                } catch (e) { console.error(e.message); }
            };
            processPhoto();
            return res.status(200).json({ 
                method: 'sendMessage', chat_id: chatId, 
                text: '📸 **Foto diterima!**\n\nMasukkan **keterangan temuan** (jangan jalan dulu!):' 
            });
        }

        // 6. UPDATE KETERANGAN
        if (text && !text.includes('/') && text !== '🏁 SELESAI' && text !== '📸 KIRIM LAPORAN FOTO') {
            const responseMsg = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
                chat_id: chatId, text: '⏳ Sedang menyimpan keterangan...'
            });
            const messageId = responseMsg.data.result.message_id;
            try {
                await axios.post(GAS_URL, { chatId, keterangan: text, action: 'update_keterangan' });
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
                    chat_id: chatId, message_id: messageId,
                    text: `✅ Keterangan: "${text}"\nBerhasil tersimpan! 🚀, SILAHKAN LANJUT SURVEY..`
                });
            } catch (err) {
                await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/editMessageText`, {
                    chat_id: chatId, message_id: messageId, text: `❌ Gagal menyimpan!`
                });
            }
            return res.status(200).send('OK');
        }

        // 7. SELESAI
        if (text === '🏁 SELESAI') {
            axios.post(GAS_URL, { chatId, action: 'stop_survey' }).catch(e => console.error(e.message));
            return res.status(200).json({
                method: 'sendMessage', chat_id: chatId,
                text: 'Tugas Selesai! ✅\n\nSistem berhenti mencatat lokasi. matikan live location agar hemat baterai.',
                reply_markup: { keyboard: [[{ text: "🚀 MULAI SURVEY", request_location: true }]], resize_keyboard: true }
            });
        }

    } catch (e) { console.error(e.message); }
    res.status(200).send('OK');
};
