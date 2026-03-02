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
        // 1. CEK WHITELIST
        const checkUser = await axios.post(GAS_URL, { 
            chatId: chatId, 
            action: 'check_user' 
        });

        if (checkUser.data.status === 'unauthorized') {
            return res.status(200).json({
                method: 'sendMessage',
                chat_id: chatId,
                text: "⚠️ **Akses Ditolak!**\n\nID Anda (" + chatId + ") tidak terdaftar. Silakan hubungi Mas Ecky."
            });
        }

        // 2. MENU START
        if (text === '/start' || text === 'Kembali') {
            return res.status(200).json({
                method: 'sendMessage',
                chat_id: chatId,
                text: `Selamat Datang di Sistem Survey Pihak ke 3.\n\nKlik **🚀 MULAI SURVEY** untuk mengaktifkan tracking lokasi.`,
                reply_markup: {
                    keyboard: [[{ text: "🚀 MULAI SURVEY", request_location: true }], [{ text: "🏁 SELESAI" }]],
                    resize_keyboard: true
                },
                parse_mode: 'Markdown'
            });
        }

        // 3. TERIMA LOKASI
        if (msg.location) {
            await axios.post(GAS_URL, { 
                chatId, 
                lat: msg.location.latitude, 
                lon: msg.location.longitude, 
                action: message ? 'start_survey' : 'tracking' 
            });
            if (message) {
                return res.status(200).json({
                    method: 'sendMessage',
                    chat_id: chatId,
                    text: `✅ **Survey Aktif!**\n\nSilakan pilih 'Share Live Location 8 Jam'.`,
                    reply_markup: { 
                        keyboard: [[{ text: "📸 KIRIM LAPORAN FOTO" }], [{ text: "🏁 SELESAI" }]], 
                        resize_keyboard: true 
                    },
                    parse_mode: 'Markdown'
                });
            }
            return res.status(200).send('OK');
        }

        // 4. TERIMA FOTO
        if (msg.photo) {
            if (!msg.location && (!msg.reply_to_message || !msg.reply_to_message.location)) {
                return res.status(200).json({
                    method: 'sendMessage',
                    chat_id: chatId,
                    text: '⚠️ **Gagal!** Aktifkan Live Location dulu.'
                });
            }

            const photoId = msg.photo[msg.photo.length - 1].file_id;
            const forward = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, { 
                chat_id: CHANNEL_ID, 
                photo: photoId, 
                caption: `Laporan dari ID: ${chatId}` 
            });

            const photoUrl = `https://t.me/c/${CHANNEL_ID.replace('-100','')}/${forward.data.result.message_id}`;
            await axios.post(GAS_URL, { chatId, foto: photoUrl, action: 'temp_photo' });
            
            return res.status(200).json({ 
                method: 'sendMessage', 
                chat_id: chatId, 
                text: '📸 **Foto diterima!** Masukkan keterangan:' 
            });
        }

        // 5. UPDATE KETERANGAN
        if (text && !text.includes('/') && text !== '🏁 SELESAI' && text !== '📸 KIRIM LAPORAN FOTO') {
            await axios.post(GAS_URL, { chatId, keterangan: text, action: 'update_keterangan' });
            return res.status(200).json({ method: 'sendMessage', chat_id: chatId, text: '✅ Keterangan disimpan!' });
        }

        // 6. SELESAI
        if (text === '🏁 SELESAI') {
            await axios.post(GAS_URL, { chatId, action: 'stop_survey' });
            return res.status(200).json({
                method: 'sendMessage',
                chat_id: chatId,
                text: 'Tugas Selesai! ✅',
                reply_markup: { 
                    keyboard: [[{ text: "🚀 MULAI SURVEY", request_location: true }]], 
                    resize_keyboard: true 
                }
            });
        }

    } catch (e) {
        console.error("Error:", e.message);
    }
    
    res.status(200).send('OK');
};
