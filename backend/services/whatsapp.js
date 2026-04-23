import twilio from "twilio";
import dotenv from "dotenv";
dotenv.config();

let client = null;
try {
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
} catch (e) {
  console.log("Twilio configured नाही:", e.message);
}

export async function sendWhatsApp(message) {
  if (!client) {
    console.log("[WhatsApp simulation]:", message);
    return { simulated: true, message };
  }
  try {
    const result = await client.messages.create({
      from: process.env.TWILIO_WHATSAPP_FROM,
      to: process.env.OWNER_WHATSAPP,
      body: message,
    });
    return { sid: result.sid, status: result.status };
  } catch (err) {
    console.error("WhatsApp पाठवणे अयशस्वी:", err.message);
    return { error: err.message };
  }
}

export async function checkLowStock(item) {
  if (item.quantity === 0) {
    const msg =
      `🔴 *DukanAI सूचना*\n\n` +
      `*${item.name}* पूर्णपणे संपले आहे!\n` +
      `आत्ता पुरवठादाराला ऑर्डर द्या.\n\n` +
      `_DukanAI — तुमच्या दुकानाचा डिजिटल मुनीम_`;
    return sendWhatsApp(msg);
  }
  if (item.quantity <= item.lowStockThreshold) {
    const msg =
      `🟡 *DukanAI सूचना*\n\n` +
      `*${item.name}* फक्त *${item.quantity} ${item.unit}* शिल्लक आहे!\n` +
      `लवकर ऑर्डर द्या, साठा संपत आला आहे.\n\n` +
      `_DukanAI — तुमच्या दुकानाचा डिजिटल मुनीम_`;
    return sendWhatsApp(msg);
  }
  return null;
}

export async function sendDailySummary(stats) {
  const msg =
    `📊 *DukanAI — आजचा हिशोब*\n\n` +
    `एकूण माल: ${stats.total} वस्तू\n` +
    `उपलब्ध: ${stats.inStock} ✅\n` +
    `कमी साठा: ${stats.lowStock} ⚠️\n` +
    `संपलेले: ${stats.outOfStock} ❌\n` +
    `आजची विक्री: ${stats.todaySales} वस्तू\n\n` +
    `_DukanAI — तुमच्या दुकानाचा डिजिटल मुनीम_`;
  return sendWhatsApp(msg);
}
