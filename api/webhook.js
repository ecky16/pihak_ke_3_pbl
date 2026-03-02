const axios = require('axios');

const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
const GAS_URL = 'https://script.google.com/macros/s/AKfycbxeAkZl8kgM9KYATer4C53fb3LsUuwa__RE7fpdDnkXOz6nR2TTsH2F8_LjvBUyOTCEwQ/exec';
const CHANNEL_ID = '-1003759185457';

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(200).send('OK');

  const { message, edited_message } = req.body;
  const msg = message || edited_message;
  if (!msg) return res.status(200).send('OK');

  const chatId = msg.chat.id;

  try {
    // 1. CEK USER KE DATABASE GAS (DOPOST AKAN MENGEMBALIKAN ERROR JIKA TIDAK ADA)
    // Untuk efisiensi, kita kirim data, nanti GAS yang validasi atau Mas Ecky bisa hardcode sementara.
    
    // 2. LOGIKA /START
    if (msg.text === '/start') {
      return res.status(200).json({
        method: 'sendMessage',
        chat_id: chatId,
        text: `Halo Mas Ecky,\n\nBot Survey Aktif! Untuk memulai tracking:\n\n1. Klik tombol **📍 Aktifkan Live Location** di bawah.\n2. Pilih durasi **8 Jam**.\n3. Jika ada temuan, langsung **Ambil Foto** via kamera.`,
        reply_markup: {
          keyboard: [
            [{ text: "📍 Aktifkan Live Location", request_location: true }],
            [{ text: "📸 Kirim Foto Laporan" }]
          ],
          resize_keyboard: true
        },
        parse_mode: 'Markdown'
      });
    }

    // 3. LOGIKA TERIMA LOKASI (LIVE LOCATION)
    if (msg.location) {
      await axios.post(GAS_URL, {
        chatId: chatId,
        lat: msg.location.latitude,
        lon: msg.location.longitude,
        action: 'tracking' // Kita tambah parameter action agar GAS tahu ini update lokasi biasa
      });
      
      // Respon hanya saat pertama kali klik tombol (bukan saat auto-update live location)
      if (message && message.location) {
        return res.status(200).json({
          method: 'sendMessage',
          chat_id: chatId,
          text: '✅ Live Location Aktif! Silakan mulai survey 2-4 KM hari ini. Jalur Anda terekam otomatis di Web.'
        });
      }
      return res.status(200).send('OK');
    }

    // 4. LOGIKA TERIMA FOTO
    if (msg.photo) {
      const photoId = msg.photo[msg.photo.length - 1].file_id;
      
      // Forward ke Channel sebagai Database
      const forward = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto`, {
        chat_id: CHANNEL_ID,
        photo: photoId,
        caption: `Laporan dari ChatID: ${chatId}`
      });

      const msgId = forward.data.result.message_id;
      const photoUrl = `https://t.me/c/${CHANNEL_ID.replace('-100','')}/${msgId}`;

      // Simpan URL Foto ke GAS sementara, lalu minta keterangan
      await axios.post(GAS_URL, {
        chatId: chatId,
        foto: photoUrl,
        action: 'temp_photo'
      });

      return res.status(200).json({
        method: 'sendMessage',
        chat_id: chatId,
        text: '📸 Foto diterima! \n\n**Masukkan keterangan temuan :**',
        parse_mode: 'Markdown'
      });
    }
if (msg.text === '🏁 Selesai Survey') {
  return res.status(200).json({
    method: 'sendMessage',
    chat_id: chatId,
    text: "Tugas selesai! ✅\n\n**PENTING:** Jangan lupa klik 'Stop Sharing' pada baris lokasi di atas agar baterai HP Anda tidak boros.",
    reply_markup: {
      remove_keyboard: true // Menghilangkan tombol keyboard agar bersih
    },
    parse_mode: 'Markdown'
  });
}
    // 5. LOGIKA TERIMA TEKS (KETERANGAN TEMUAN)
    if (msg.text && !msg.text.includes('/')) {
       await axios.post(GAS_URL, {
        chatId: chatId,
        keterangan: msg.text,
        action: 'update_keterangan'
      });

      return res.status(200).json({
        method: 'sendMessage',
        chat_id: chatId,
        text: '✅ Keterangan berhasil disimpan ke laporan terakhir.'
      });
    }

  } catch (err) {
    console.error(err.message);
  }

  res.status(200).send('OK');
};
