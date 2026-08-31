export interface PictureCard {
  id: string;
  icon: string;
  text: string;
  pronunciation?: string;
}

export type CategoryMap = Record<string, PictureCard[]>;

export const INITIAL_CARDS: CategoryMap = {
  "朝礼挨拶": [
    { id: "c1", icon: "🌅", text: "みなさんおはようございます！" },
    { id: "c2", icon: "🤝", text: "本日もよろしくお願いいたします。" },
    { id: "c3", icon: "🙋", text: "はい、出席しています。" }
  ],
  "作業質問": [
    { id: "c4", icon: "❓", text: "質問があります。" },
    { id: "c5", icon: "🔄", text: "もう一度説明をお願いできますか？" },
    { id: "c6", icon: "✅", text: "確認が終わりました。" },
    { id: "c7", icon: "📄", text: "資料を1枚いただけますか？" }
  ],
  "体調休憩": [
    { id: "c8", icon: "☕", text: "少し休憩してもいいですか？" },
    { id: "c9", icon: "🤒", text: "少し体調がすぐれません。" },
    { id: "c10", icon: "🙆", text: "大丈夫です！問題ありません。" }
  ],
  "雑談": [
    { id: "c11", icon: "😊", text: "ありがとうございます！" },
    { id: "c12", icon: "👏", text: "すごいですね！" },
    { id: "c13", icon: "🎮", text: "ゲームやテーブルゲームが好きです。" }
  ]
};
