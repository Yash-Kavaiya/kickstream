import type { Language } from "../i18n";

/** Codes and Azure voices match services/pipeline/kickstream/autolive/languages.py. */
export interface CommentaryLanguage {
  id: string;
  name: string;
  native: string;
  sample: string;
  voices: { id: string; label: string }[];
}

const voice = (id: string, label: string) => ({ id, label });

export const COMMENTARY_LANGUAGES: readonly CommentaryLanguage[] = [
  {
    id: "en", name: "English", native: "English",
    sample: "This is Kickstream Live, football around the clock, with seven AI agents and live commentary.",
    voices: [
      voice("en-GB-RyanNeural", "Ryan (UK)"),
      voice("en-GB-SoniaNeural", "Sonia (UK)"),
      voice("en-GB-ThomasNeural", "Thomas (UK)"),
      voice("en-US-AndrewNeural", "Andrew (US)"),
      voice("en-US-AvaNeural", "Ava (US)"),
      voice("en-US-GuyNeural", "Guy (US)"),
      voice("en-US-JennyNeural", "Jenny (US)"),
      voice("en-AU-WilliamNeural", "William (Australia)"),
      voice("en-IE-ConnorNeural", "Connor (Ireland)"),
      voice("en-IN-PrabhatNeural", "Prabhat (India)"),
      voice("en-IN-NeerjaNeural", "Neerja (India)"),
    ],
  },
  {
    id: "es", name: "Spanish", native: "Español",
    sample: "Esto es Kickstream Live, fútbol a todas horas, con siete agentes de inteligencia y comentario en directo.",
    voices: [voice("es-ES-AlvaroNeural", "Álvaro (España)"), voice("es-ES-ElviraNeural", "Elvira (España)"), voice("es-MX-JorgeNeural", "Jorge (México)")],
  },
  {
    id: "hi", name: "Hindi", native: "हिन्दी",
    sample: "यह है Kickstream Live, चौबीसों घंटे फुटबॉल, सात एआई एजेंट और लाइव कमेंट्री के साथ।",
    voices: [voice("hi-IN-MadhurNeural", "मधुर"), voice("hi-IN-SwaraNeural", "स्वरा")],
  },
  {
    id: "pt", name: "Portuguese", native: "Português",
    sample: "Aqui é a Kickstream Live, futebol o dia todo, com sete agentes de IA e comentário ao vivo.",
    voices: [voice("pt-BR-AntonioNeural", "Antônio (Brasil)"), voice("pt-BR-FranciscaNeural", "Francisca (Brasil)"), voice("pt-PT-DuarteNeural", "Duarte (Portugal)")],
  },
  {
    id: "fr", name: "French", native: "Français",
    sample: "Ici Kickstream Live, le football en continu, avec sept agents d'IA et un commentaire en direct.",
    voices: [voice("fr-FR-HenriNeural", "Henri"), voice("fr-FR-DeniseNeural", "Denise")],
  },
  {
    id: "de", name: "German", native: "Deutsch",
    sample: "Hier ist Kickstream Live, Fußball rund um die Uhr, mit sieben KI-Agenten und Live-Kommentar.",
    voices: [voice("de-DE-ConradNeural", "Conrad"), voice("de-DE-KatjaNeural", "Katja")],
  },
  {
    id: "it", name: "Italian", native: "Italiano",
    sample: "Qui è Kickstream Live, calcio a tutte le ore, con sette agenti IA e commento dal vivo.",
    voices: [voice("it-IT-DiegoNeural", "Diego"), voice("it-IT-ElsaNeural", "Elsa")],
  },
  {
    id: "nl", name: "Dutch", native: "Nederlands",
    sample: "Dit is Kickstream Live, voetbal rond de klok, met zeven AI-agenten en livecommentaar.",
    voices: [voice("nl-NL-MaartenNeural", "Maarten"), voice("nl-NL-FennaNeural", "Fenna")],
  },
  {
    id: "pl", name: "Polish", native: "Polski",
    sample: "Tu Kickstream Live, piłka nożna przez całą dobę, z siedmioma agentami AI i komentarzem na żywo.",
    voices: [voice("pl-PL-MarekNeural", "Marek"), voice("pl-PL-ZofiaNeural", "Zofia")],
  },
  {
    id: "tr", name: "Turkish", native: "Türkçe",
    sample: "Burası Kickstream Live, gün boyu futbol, yedi yapay zeka ajanı ve canlı yorumla.",
    voices: [voice("tr-TR-AhmetNeural", "Ahmet"), voice("tr-TR-EmelNeural", "Emel")],
  },
  {
    id: "ar", name: "Arabic", native: "العربية",
    sample: "هنا Kickstream Live، كرة القدم على مدار الساعة، مع سبعة وكلاء ذكاء وتعليق مباشر.",
    voices: [voice("ar-SA-HamedNeural", "حامد"), voice("ar-SA-ZariyahNeural", "زارية")],
  },
  {
    id: "ru", name: "Russian", native: "Русский",
    sample: "Это Kickstream Live, футбол круглые сутки, семь агентов ИИ и живой комментарий.",
    voices: [voice("ru-RU-DmitryNeural", "Дмитрий"), voice("ru-RU-SvetlanaNeural", "Светлана")],
  },
  {
    id: "zh", name: "Chinese", native: "中文",
    sample: "这里是 Kickstream Live，全天候足球，七位智能体和实时解说。",
    voices: [voice("zh-CN-YunxiNeural", "云希"), voice("zh-CN-XiaoxiaoNeural", "晓晓")],
  },
  {
    id: "ja", name: "Japanese", native: "日本語",
    sample: "こちらは Kickstream Live。一日中のサッカーを、7つのAIエージェントと実況でお届けします。",
    voices: [voice("ja-JP-KeitaNeural", "圭太"), voice("ja-JP-NanamiNeural", "七海")],
  },
  {
    id: "ko", name: "Korean", native: "한국어",
    sample: "여기는 Kickstream Live입니다. 하루 종일 축구를 일곱 AI 에이전트와 실시간 해설로 전합니다.",
    voices: [voice("ko-KR-InJoonNeural", "인준"), voice("ko-KR-SunHiNeural", "선히")],
  },
  {
    id: "id", name: "Indonesian", native: "Bahasa Indonesia",
    sample: "Ini Kickstream Live, sepak bola sepanjang hari, dengan tujuh agen AI dan komentar langsung.",
    voices: [voice("id-ID-ArdiNeural", "Ardi"), voice("id-ID-GadisNeural", "Gadis")],
  },
  {
    id: "bn", name: "Bengali", native: "বাংলা",
    sample: "এটি Kickstream Live, সারাদিন ফুটবল, সাতটি এআই এজেন্ট ও সরাসরি ধারাভাষ্যসহ।",
    voices: [voice("bn-IN-BashkarNeural", "ভাস্কর"), voice("bn-IN-TanishaaNeural", "তনিশা")],
  },
  {
    id: "ta", name: "Tamil", native: "தமிழ்",
    sample: "இது Kickstream Live. நாள் முழுவதும் கால்பந்து, ஏழு AI முகவர்களுடன் நேரடி விளக்கவுரை.",
    voices: [voice("ta-IN-ValluvarNeural", "வள்ளுவர்"), voice("ta-IN-PallaviNeural", "பல்லவி")],
  },
  {
    id: "ur", name: "Urdu", native: "اردو",
    sample: "یہ ہے Kickstream Live، دن بھر فٹبال، سات اے آئی ایجنٹس اور براہ راست کمنٹری کے ساتھ۔",
    voices: [voice("ur-PK-AsadNeural", "اسد"), voice("ur-PK-UzmaNeural", "عظمیٰ")],
  },
  {
    id: "mr", name: "Marathi", native: "मराठी",
    sample: "हे आहे Kickstream Live, दिवसभर फुटबॉल, सात एआई एजंट आणि थेट समालोचन.",
    voices: [voice("mr-IN-ManoharNeural", "मनोहर"), voice("mr-IN-AarohiNeural", "आरोही")],
  },
];

export function commentaryLanguage(id: string | null | undefined): CommentaryLanguage {
  return COMMENTARY_LANGUAGES.find((language) => language.id === id) ?? COMMENTARY_LANGUAGES[0];
}

/** Screen labels exist in English, Spanish and Hindi. Every other commentary language keeps English labels. */
export function screenLanguage(id: string | null | undefined): Language {
  return id === "es" || id === "hi" ? id : "en";
}
