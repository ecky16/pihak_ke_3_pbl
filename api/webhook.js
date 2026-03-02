const axios = require('axios');

// KONFIGURASI (Ganti dengan Token Mas Ecky)
const TELEGRAM_TOKEN = 'TOKEN_BOT_TELEGRAM_MAS_ECKY';
const CHANNEL_ID = '-1003759185457'; // ID Channel Database Foto
const GAS_URL = 'URL_DEPLOY_APPS_SCRIPT_MAS_ECKY';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('OK');

  const { message } = req.body;
  if (!message) return res.status(200).send('OK');

  const chatId = message.chat.id;

  // 1. LOGIKA TERIMA LOKASI
  if (message.location) {
    const { latitude, longitude } = message.location;
    
    // Simpan koordinat ke Sheets (Tanpa Foto)
    await axios.post(GAS_URL, {
      chatId: chatId,
      nama: message.from.first_name,
      lat: latitude,
      lon: longitude,
      foto: 'Hanya Update Lokasi',
      keterangan: 'Tracking Pergerakan'
    });

    return res.status(200).json({ method: 'sendMessage', chat_id: chatId, text: '📍 Lokasi tercatat untuk mapping.' });
  }

  // 2. LOGIKA TERIMA FOTO + CAPTION
  if (message.photo) {
    const photo = message.photo[message.photo.length - 1]; // Kualitas terbaik
    const caption = message.caption || 'Laporan Tanpa Keterangan';

    try {
      // Forward ke Channel
      const forwardRes = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
        chat_id: CHANNEL_ID,
        photo: photo.file_id,
        caption: `User: ${message.from.first_name}\nKet: ${caption}`
      });

      const messageId = forwardRes.data.result.message_id;
      const cleanChannelId = CHANNEL_ID.replace('-100', '');
      const photoUrl = `https://t.me/c/${cleanChannelId}/${messageId}`;

      // Kirim ke Google Sheets
      await axios.post(GAS_URL, {
        chatId: chatId,
        nama: message.from.first_name,
        lat: 0, // Nanti teknisi diminta kirim lokasi juga
        lon: 0,
        foto: photoUrl,
        keterangan: caption
      });

      return res.status(200).json({ 
        method: 'sendMessage', 
        chat_id: chatId, 
        text: '✅ Foto terupload! Jangan lupa kirim LOKASI (Share Location) agar mapping akurat.' 
      });
    } catch (err) {
      console.error(err);
    }
  }

  res.status(200).send('OK');
};
