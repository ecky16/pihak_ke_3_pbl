const axios = require('axios');
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const CHANNEL_ID = '-1003759185457';
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxeAkZl8kgM9KYATer4C53fb3LsUuwa__RE7fpdDnkXOz6nR2TTsH2F8_LjvBUyOTCEwQ/exec';

module.exports = async (req, res) => {
    if (req.method !== 'POST') return res.status(200).send('OK');
    const { message, edited_message } = req.body;
    const msg = message || edited_message;
    if (!msg) return res.status(200).send('OK');

    const chatId = msg.chat.id.toString();
    const text = msg.text || "";

    try {
        // 1. CEK WHITELIST (Wajib ditunggu agar keamanan terjaga)
        const checkUser = await axios.post(GAS_URL, { chatId: chatId, action: 'check_user' });
        if (checkUser.data.status === 'unauthorized') {
            return res.status(200).json({
                method: 'sendMessage',
                chat_id: chatId,
                text: "⚠️ **Akses Ditolak!**\n\nID Anda (" + chatId + ") tidak terdaftar."
            });
        }

        // 2. MENU START / KEMBALI
        if (text === '/start' || text === 'Kembali') {
            return res.status(200).json({
                method: 'sendMessage', chat_id: chatId,
                text: `Selamat Datang di Sistem Survey Pihak ke 3.\n\nKlik **🚀 MULAI SURVEY** untuk mengaktifkan tracking lokasi.`,
                reply_markup: {
                    keyboard: [[{ text: "🚀 MULAI SURVEY", request_location: true }], [{ text: "🏁 SELESAI" }]],
                    resize_keyboard: true
                }, parse_mode: 'Markdown'
            });
        }

        // 3. INSTRUKSI KIRIM FOTO (Fast Response)
        if (text === '📸 KIRIM LAPORAN FOTO') {
            return res.status(200).json({
                method: 'sendMessage', chat_id: chatId,
                text: 'Silakan klik ikon 📎 **Lampiran** lalu pilih 📸 **Kamera** untuk memotret temuan Anda.'
            });
        }

        // 4. TERIMA LOKASI
        if (msg.location) {
            // Jalankan simpan ke GAS di background
            axios.post(GAS_URL, { chatId, lat: msg.location.latitude, lon: msg.location.longitude, action: message ? 'start_survey' : 'tracking' }).catch(e => console.error(e.message));
            
            if (message) {
                return res.status(200).json({
                    method: 'sendMessage', chat_id: chatId,
                    text: `✅ **Survey Aktif!**\n\n**PENTING:** Klik ikon 📎 (Paperclip) > Location > **Share My Live Location for 8 Hours**.`,
                    reply_markup: { keyboard: [[{ text: "📸 KIRIM LAPORAN FOTO" }], [{ text: "🏁 SELESAI" }]], resize_keyboard: true },
                    parse_mode: 'Markdown'
                });
            }
            return res.status(200).send('OK');
        }

        // 5. TERIMA FOTO (VERSI FAST RESPONSE)
        if (msg.photo) {
            const photoId = msg.photo[msg.photo.length - 1].file_id;

            // Jalankan proses berat di background tanpa 'await'
            const processPhoto = async () => {
                try {
                    const forward = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, { 
                        chat_id: CHANNEL_ID, 
                        photo: photoId, 
                        caption: `Laporan dari ID: ${chatId}` 
                    });
                    const photoUrl = `https://t.me/c/${CHANNEL_ID.replace('-100','')}/${forward.data.result.message_id}`;
                    await axios.post(GAS_URL, { chatId, foto: photoUrl, action: 'temp_photo' });
                } catch (e) { console.error("Error background process:", e.message); }
            };
            
            processPhoto(); // Jalankan fungsi di atas

            // Langsung balas ke user tanpa nunggu proses selesai
            return res.status(200).json({ 
                method: 'sendMessage', 
                chat_id: chatId, 
                text: '📸 **Foto diterima!**\n\nSilakan langsung masukkan **keterangan temuan** :' 
            });
        }

        // 6. UPDATE KETERANGAN (INTERAKTIF & KEREN)
if (text && !text.includes('/') && text !== '🏁 SELESAI' && text !== '📸 KIRIM LAPORAN FOTO') {
    try {
        // 1. Kirim pesan awal (Jam Pasir) dan ambil ID Pesannya
        const responseMsg = await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: chatId,
            text: '⏳ Sedang menyimpan keterangan...'
        });
        
        const messageId = responseMsg.data.result.message_id;

        // 2. Kirim data ke Google Sheets (GAS)
        await axios.post(GAS_URL, { chatId, keterangan: text, action: 'update_keterangan' });

        // 3. EDIT PESAN TADI kalau sudah berhasil
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
            chat_id: chatId,
            message_id: messageId,
            text: `✅ Keterangan: "${text}"\nBerhasil tersimpan di database! 🚀`
        });

        return res.status(200).send('OK');
    } catch (e) {
        console.error(e.message);
        return res.status(200).send('Error');
    }
}}

        // 7. SELESAI
        if (text === '🏁 SELESAI') {
            axios.post(GAS_URL, { chatId, action: 'stop_survey' }).catch(e => console.error(e.message));
            return res.status(200).json({
                method: 'sendMessage', chat_id: chatId,
                text: 'Tugas Selesai! ✅\n\nSistem berhenti mencatat lokasi.',
                reply_markup: { keyboard: [[{ text: "🚀 MULAI SURVEY", request_location: true }]], resize_keyboard: true }
            });
        }

    } catch (e) { console.error("Error:", e.message); }
    res.status(200).send('OK');
};
