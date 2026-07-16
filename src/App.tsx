import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent, ReactNode, Ref } from "react";
import tabPlanIcon from "./assets/icons/Lui-icon-date.svg?raw";
import tabPlanIconSolid from "./assets/icons/Lui-icon-date-solid.svg?raw";
import tabRecordIcon from "./assets/icons/Lui-icon-help-manual.svg?raw";
import tabRecordIconSolid from "./assets/icons/Lui-icon-help-manual-solid.svg?raw";
import tabHomeIcon from "./assets/icons/Lui-icon-s-home.svg?raw";
import tabHomeIconSolid from "./assets/icons/Lui-icon-s-home-solid.svg?raw";
import refreshIcon from "./assets/icons/Lui-icon-refresh.svg?raw";
import petCat from "./pet-cat.png";
import planCatMove from "./plan-cat-move.png";
import planCatSleep from "./plan-cat-sleep.png";
import planCatTrust from "./plan-cat-trust.png";

type TaskStatus = "not_started" | "partial" | "done";
type TabKey = "home" | "record" | "plan" | "dailyHistory" | "evidenceHistory" | "planHistory";
type IconName =
  | "bath"
  | "bike"
  | "book"
  | "bowl"
  | "breath"
  | "broom"
  | "calendar"
  | "calm"
  | "car"
  | "chat"
  | "clothes"
  | "footprints"
  | "heart"
  | "home"
  | "leaf"
  | "map"
  | "mic"
  | "mirror"
  | "moon"
  | "notebook"
  | "park"
  | "phone"
  | "refresh"
  | "save"
  | "scale"
  | "search"
  | "shoulder"
  | "sleep"
  | "soup"
  | "sprout"
  | "stairs"
  | "sun"
  | "utensils"
  | "water"
  | "waves"
  | "window";

type ActualResult =
  | "没发生"
  | "发生了一点，但我处理了"
  | "发生了，但没有我想象中严重"
  | "今天还没法判断";

type VoiceTarget = "worry" | "bodyReaction" | "selfHelpAction" | "messageToSelf";

type WorryRecord = {
  worry: string;
  bodyReaction: string;
  actualResult: ActualResult;
  selfHelpAction: string;
  messageToSelf: string;
  evidence: string;
};

type DailyTaskRecord = {
  id: string;
  label: string;
  title: string;
  note: string;
  tone: "purple" | "pink" | "blue";
  status: TaskStatus;
  selected?: boolean;
};

type DailyRecoveryRecord = {
  date: string;
  sunlightStatus: TaskStatus;
  walkStatus: TaskStatus;
  recordStatus: TaskStatus;
  dailyTasks?: DailyTaskRecord[];
  dailyTasksSavedAt?: string;
  energyLevel?: number;
  anxietyLevel?: number;
  worryRecord?: WorryRecord;
};

type PlanGroupKey = "noise" | "trust" | "manage";
type PlanHistoryRange = "day" | "week" | "month" | "halfYear" | "year";

type MonthlyTaskStat = {
  title: string;
  label: string;
  count: number;
  icon: IconName;
};

type PlanHistoryTaskStat = MonthlyTaskStat & {
  percentage: number;
};

type SpeechResult = {
  isFinal: boolean;
  0: {
    transcript: string;
  };
};

type SpeechRecognitionEventLike = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechResult;
  };
};

type SpeechRecognitionErrorEventLike = Event & {
  error: string;
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  }
}

const STORAGE_KEY = "manmanhuilai.fresh.records.v1";
const DEFAULT_MESSAGE = "我今天不是失败了，我只是很累。";

const statusLabels: Record<TaskStatus, string> = {
  not_started: "未开始",
  partial: "做了一点也算",
  done: "已完成",
};

type TaskStatusLabels = Record<TaskStatus, string>;

const resultOptions: ActualResult[] = [
  "没发生",
  "发生了一点，但我处理了",
  "发生了，但没有我想象中严重",
  "今天还没法判断",
];

const voiceTargetLabels: Record<VoiceTarget, string> = {
  worry: "我今天担心了什么？",
  bodyReaction: "当时身体有什么反应？",
  selfHelpAction: "我做了什么帮助自己？",
  messageToSelf: "给今天的自己一句话",
};

const planMonths = [
  {
    title: "第1个月：先让身体降噪",
    goal: "不减肥，不挑战高速，不强迫运动。",
    tasks: ["晒太阳 10 分钟", "晚饭后散步 10-20 分钟", "正常吃三顿饭", "记录一个“没有发生的灾难”"],
    tip: "这个月不是为了变强，是为了让身体停止一直报警。",
    cat: "sleep",
  },
  {
    title: "第2个月：恢复一点身体信任",
    goal: "让身体重新相信：心跳、手麻、紧张都可以被承受。",
    tasks: ["每周 2 次轻快走 20-30 分钟", "每周 1 次短途开车，固定路线", "上班固定高速路线开车", "记录睡眠状态"],
    tip: "恢复不是完全不怕，而是怕的时候也能处理一点点。",
    cat: "trust",
  },
  {
    title: "第3个月：轻度挑战和体重管理",
    goal: "开始温和减脂，但不节食。",
    tasks: ["每餐先吃蛋白质", "晚餐主食减半，但不取消", "每周 3 次快走", "膝盖疼时改为椭圆机/骑车/游泳"],
    tip: "我不是在证明自己没事，我是在重新学习：我可以一点点回来。",
    cat: "move",
  },
] as const;

const extraDailyTaskCategories = [
  {
    name: "身体安抚",
    tasks: ["喝一杯温水", "做 3 次慢呼吸", "洗个热水澡/泡脚", "做一次护肤", "给肩颈放松 3 分钟", "感到心慌时安抚自己"],
  },
  {
    name: "睡眠修复",
    tasks: ["睡前放下手机 10 分钟", "早点躺下但不强迫睡着"],
  },
  {
    name: "饮食稳定",
    tasks: ["正常吃一份主食", "吃一份蛋白质"],
  },
  {
    name: "轻活动",
    tasks: ["走到楼下再回来"],
  },
  {
    name: "焦虑降噪",
    tasks: ["不搜索身体症状", "记录一次身体误报", "给自己发一句安抚话", "今天允许自己慢一点"],
  },
  {
    name: "外出/开车信任",
    tasks: ["开一小段熟悉路线", "出门逛街/逛公园了"],
  },
  {
    name: "体重友好",
    tasks: ["今天不称体重", "不因为体重少吃一顿", "穿一件舒服的衣服", "对镜子里的自己少批评一句"],
  },
  {
    name: "生活恢复",
    tasks: ["做一件不用表现的小事", "整理一个小角落", "和一个安全的人说句话", "给今天留 10 分钟空白"],
  },
] as const;

const currentMonthPlanGroups: Array<{
  key: PlanGroupKey;
  title: string;
  tip: string;
  cat: "sleep" | "trust" | "move";
}> = [
  {
    key: "noise",
    title: "让身体降噪",
    tip: "本月先看见身体被照顾过的地方，不急着加难度。",
    cat: "sleep",
  },
  {
    key: "trust",
    title: "恢复身体信任",
    tip: "这里放的是你和外界、心跳、行动慢慢重新熟悉的证据。",
    cat: "trust",
  },
  {
    key: "manage",
    title: "温和管理",
    tip: "体重、饮食、活动都只做温和调整，不用惩罚身体。",
    cat: "move",
  },
];

const planHistoryRangeOptions: Array<{ key: PlanHistoryRange; label: string }> = [
  { key: "day", label: "当日" },
  { key: "week", label: "当周" },
  { key: "month", label: "当月" },
  { key: "halfYear", label: "半年" },
  { key: "year", label: "一年" },
];

const PLAN_TASK_DISPLAY_LIMIT = 4;

const countableNotStartedTasks = new Set([
  "记录睡眠状态",
  "不搜索身体症状",
  "对镜子里的自己少批评一句",
]);

const taskPlanGroupMap: Record<string, PlanGroupKey> = {
  "晒太阳 10 分钟": "trust",
  "晚饭后散步 10-20 分钟": "trust",
  "正常吃三顿饭": "manage",
  "记录一个“没有发生的灾难”": "noise",
  "喝一杯温水": "noise",
  "做 3 次慢呼吸": "noise",
  "洗个热水澡/泡脚": "noise",
  "做一次护肤": "noise",
  "给肩颈放松 3 分钟": "noise",
  "记录睡眠状态": "noise",
  "睡前放下手机 10 分钟": "noise",
  "早点躺下但不强迫睡着": "noise",
  "不搜索身体症状": "noise",
  "记录一次身体误报": "noise",
  "给自己发一句安抚话": "noise",
  "今天允许自己慢一点": "noise",
  "每周 2 次轻快走 20-30 分钟": "trust",
  "每周 1 次短途开车，固定路线": "trust",
  "上班固定高速路线开车": "trust",
  "感到心慌时安抚自己": "trust",
  "走到楼下再回来": "trust",
  "开一小段熟悉路线": "trust",
  "出门逛街/逛公园了": "trust",
  "做一件不用表现的小事": "trust",
  "整理一个小角落": "trust",
  "和一个安全的人说句话": "trust",
  "给今天留 10 分钟空白": "trust",
  "每餐先吃蛋白质": "manage",
  "晚餐主食减半，但不取消": "manage",
  "每周 3 次快走": "trust",
  "膝盖疼时改为椭圆机/骑车/游泳": "trust",
  "正常吃一份主食": "manage",
  "吃一份蛋白质": "manage",
  "今天不称体重": "manage",
  "不因为体重少吃一顿": "manage",
  "穿一件舒服的衣服": "manage",
  "对镜子里的自己少批评一句": "manage",
};

const planGuidanceTaskPool: Record<PlanGroupKey, string[]> = {
  noise: [
    "记录一个“没有发生的灾难”",
    "喝一杯温水",
    "做 3 次慢呼吸",
    "做一次护肤",
    "给肩颈放松 3 分钟",
    "记录睡眠状态",
    "睡前放下手机 10 分钟",
    "不搜索身体症状",
    "记录一次身体误报",
    "给自己发一句安抚话",
    "今天允许自己慢一点",
  ],
  trust: [
    "晒太阳 10 分钟",
    "晚饭后散步 10-20 分钟",
    "每周 2 次轻快走 20-30 分钟",
    "每周 1 次短途开车，固定路线",
    "上班固定高速路线开车",
    "感到心慌时安抚自己",
    "走到楼下再回来",
    "开一小段熟悉路线",
    "出门逛街/逛公园了",
    "做一件不用表现的小事",
    "整理一个小角落",
    "和一个安全的人说句话",
    "每周 3 次快走",
    "膝盖疼时改为椭圆机/骑车/游泳",
  ],
  manage: [
    "正常吃三顿饭",
    "每餐先吃蛋白质",
    "晚餐主食减半，但不取消",
    "正常吃一份主食",
    "吃一份蛋白质",
    "今天不称体重",
    "穿一件舒服的衣服",
    "对镜子里的自己少批评一句",
    "不因为体重少吃一顿",
  ],
};

const taskStatusLabelMap: Record<string, TaskStatusLabels> = {
  "晒太阳 10 分钟": { not_started: "没晒到", partial: "晒了一小会儿", done: "晒够 10 分钟" },
  "晚饭后散步 10-20 分钟": { not_started: "没出门", partial: "走了一小段", done: "走够 20 分钟" },
  "正常吃三顿饭": { not_started: "没吃齐", partial: "吃了两顿也算", done: "正常吃了三顿" },
  "记录一个“没有发生的灾难”": { not_started: "今天没记录", partial: "想到了一个", done: "写下一条证据" },
  "每周 2 次轻快走 20-30 分钟": { not_started: "今天没走", partial: "轻快走了一会儿", done: "走够 20-30 分钟" },
  "每周 1 次短途开车，固定路线": { not_started: "今天没开", partial: "开了一小段", done: "完成固定路线" },
  "上班固定高速路线开车": { not_started: "今天没上高速", partial: "走了一段熟悉高速", done: "完成上班高速路线" },
  "记录睡眠状态": { not_started: "熬大夜", partial: "普通睡眠", done: "睡的很饱" },
  "每餐先吃蛋白质": { not_started: "没特别注意", partial: "有一餐先吃了", done: "每餐都先吃了" },
  "晚餐主食减半，但不取消": { not_started: "没调整", partial: "少吃了一点", done: "减半但没取消" },
  "每周 3 次快走": { not_started: "今天没走", partial: "快走了一会儿", done: "完成一次快走" },
  "膝盖疼时改为椭圆机/骑车/游泳": { not_started: "硬扛了", partial: "换了轻一点方式", done: "好好保护了膝盖" },
  "喝一杯温水": { not_started: "没顾上", partial: "喝了几口", done: "喝完一杯" },
  "做 3 次慢呼吸": { not_started: "还没做", partial: "做了一轮", done: "身体慢下来一点" },
  "洗个热水澡/泡脚": { not_started: "没做", partial: "简单洗了洗", done: "身体舒服了一点" },
  "做一次护肤": { not_started: "没洗脸", partial: "简单护肤", done: "认真护肤甚至敷了面膜！" },
  "给肩颈放松 3 分钟": { not_started: "没放松", partial: "动了几下", done: "放松了一轮" },
  "感到心慌时安抚自己": { not_started: "立刻紧张了", partial: "安抚了1分钟内恢复", done: "安静等过了那阵感觉" },
  "睡前放下手机 10 分钟": { not_started: "没放下", partial: "放下了一会儿", done: "做到了 10 分钟" },
  "早点躺下但不强迫睡着": { not_started: "没做到", partial: "躺早了一点", done: "给身体留了时间" },
  "正常吃一份主食": { not_started: "没吃主食", partial: "吃了一点", done: "好好吃了" },
  "吃一份蛋白质": { not_started: "没注意", partial: "吃了一点", done: "吃到一份" },
  "走到楼下再回来": { not_started: "没下楼", partial: "走到门口", done: "下楼走了一圈" },
  "不搜索身体症状": { not_started: "搜了也停下了", partial: "少搜了一次", done: "今天没搜索" },
  "记录一次身体误报": { not_started: "还没记录", partial: "想到了一次", done: "写下一条" },
  "给自己发一句安抚话": { not_started: "没发", partial: "想了一句", done: "写下来了" },
  "今天允许自己慢一点": { not_started: "很难允许", partial: "想起来一次", done: "真的慢了一点" },
  "开一小段熟悉路线": { not_started: "今天没开", partial: "开了一小段", done: "完成熟悉路线" },
  "出门逛街/逛公园了": { not_started: "没去", partial: "去了一会儿", done: "认真逛了" },
  "今天不称体重": { not_started: "称了也没事", partial: "忍住一次", done: "今天没称" },
  "不因为体重少吃一顿": { not_started: "没做到", partial: "吃了一点", done: "正常吃了" },
  "穿一件舒服的衣服": { not_started: "忍着不舒服", partial: "换了一下", done: "穿得舒服" },
  "对镜子里的自己少批评一句": { not_started: "批评了也停下", partial: "安静观察", done: "夸了自己" },
  "做一件不用表现的小事": { not_started: "没做", partial: "做了一点", done: "做完一件" },
  "整理一个小角落": { not_started: "没整理", partial: "收了一点", done: "整理好一处" },
  "和一个安全的人说句话": { not_started: "没联系", partial: "发了一句", done: "聊了一会儿" },
  "给今天留 10 分钟空白": { not_started: "没留出来", partial: "留了一点", done: "安静待了 10 分钟" },
};

const taskLabelMap: Record<string, string> = {
  "喝一杯温水": "喝水",
  "做 3 次慢呼吸": "呼吸",
  "洗个热水澡/泡脚": "放松",
  "做一次护肤": "护肤",
  "给肩颈放松 3 分钟": "肩颈",
  "感到心慌时安抚自己": "安抚",
  "睡前放下手机 10 分钟": "睡前",
  "早点躺下但不强迫睡着": "躺下",
  "正常吃一份主食": "吃饭",
  "吃一份蛋白质": "蛋白质",
  "走到楼下再回来": "下楼",
  "不搜索身体症状": "降噪",
  "记录一次身体误报": "误报",
  "给自己发一句安抚话": "安抚",
  "今天允许自己慢一点": "慢一点",
  "开一小段熟悉路线": "路线",
  "出门逛街/逛公园了": "外出",
  "今天不称体重": "体重",
  "不因为体重少吃一顿": "吃饭",
  "穿一件舒服的衣服": "舒服",
  "对镜子里的自己少批评一句": "镜子",
  "做一件不用表现的小事": "小事",
  "整理一个小角落": "整理",
  "和一个安全的人说句话": "联系",
  "给今天留 10 分钟空白": "空白",
};

const taskNoteMap: Record<string, string> = {
  "喝一杯温水": "一点温热入口，也是在告诉身体：我在照顾你。",
  "做 3 次慢呼吸": "不追求立刻平静，只给身体一个慢下来的信号。",
  "洗个热水澡/泡脚": "让温度帮身体松一点，简单洗洗也算。",
  "做一次护肤": "照顾脸，也是在提醒自己：我值得被好好对待。",
  "给肩颈放松 3 分钟": "身体绷住很正常，松一点点就够了。",
  "感到心慌时安抚自己": "心慌来时不用赢过它，陪自己等一等。",
  "睡前放下手机 10 分钟": "不是强迫早睡，只是给大脑一点降噪时间。",
  "早点躺下但不强迫睡着": "躺下就是休息，不必马上睡着。",
  "正常吃一份主食": "主食不是敌人，稳定供应会让身体安心。",
  "吃一份蛋白质": "给身体一点扎实的材料，不需要完美搭配。",
  "走到楼下再回来": "走到门口也可以，先让身体知道外面是安全的。",
  "不搜索身体症状": "想搜也很正常，能停下一次就已经在降噪。",
  "记录一次身体误报": "身体报警不等于危险，写下它过去的证据。",
  "给自己发一句安抚话": "像对朋友说话那样，对今天的自己说一句。",
  "今天允许自己慢一点": "慢不是退步，是身体在重新找节奏。",
  "开一小段熟悉路线": "熟悉路线就够了，不需要临时加难度。",
  "出门逛街/逛公园了": "出去一会儿也算，不需要逛很久。",
  "今天不称体重": "把一天从数字里拿回来，先照顾身体感受。",
  "不因为体重少吃一顿": "今天的身体仍然需要被供应，不用惩罚它。",
  "穿一件舒服的衣服": "让衣服配合身体，不让身体去忍衣服。",
  "对镜子里的自己少批评一句": "先练习少攻击自己，安静看见也算。",
  "做一件不用表现的小事": "不为了证明什么，只是恢复一点生活感。",
  "整理一个小角落": "小范围变清爽一点，今天就够了。",
  "和一个安全的人说句话": "联系一点点，不用解释太多。",
  "给今天留 10 分钟空白": "什么都不产出，也是在恢复。",
};

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDateKey(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function getStartOfToday(now = new Date()) {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function getStartOfWeek(now = new Date()) {
  const start = getStartOfToday(now);
  const day = start.getDay();
  const diff = day === 0 ? 6 : day - 1;
  start.setDate(start.getDate() - diff);
  return start;
}

function getRangeStart(range: PlanHistoryRange, now = new Date()) {
  if (range === "day") return getStartOfToday(now);
  if (range === "week") return getStartOfWeek(now);
  if (range === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === "halfYear") return new Date(now.getFullYear(), now.getMonth() - 5, 1);
  return new Date(now.getFullYear(), 0, 1);
}

function getTotalDaysInRange(range: PlanHistoryRange, now = new Date()) {
  if (range === "day") return 1;
  if (range === "week") return 7;

  const start = getRangeStart(range, now);
  const end = range === "halfYear"
    ? new Date(now.getFullYear(), now.getMonth() + 1, 0)
    : range === "year"
      ? new Date(now.getFullYear(), 11, 31)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return Math.max(1, Math.floor((end.getTime() - start.getTime()) / millisecondsPerDay) + 1);
}

function getRangeLabel(range: PlanHistoryRange) {
  const now = new Date();
  if (range === "day") return formatDateKey(now);
  if (range === "week") return `${formatDateKey(getStartOfWeek(now))} 起`;
  if (range === "month") return `${now.getMonth() + 1}月`;
  if (range === "halfYear") return "近半年";
  return `${now.getFullYear()}年`;
}

function getCurrentMonthTitle() {
  return `${new Date().getMonth() + 1}月计划`;
}

function getPreviousMonthLabel() {
  const now = new Date();
  const previous = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${previous.getMonth() + 1}月`;
}

function hashDate(date: string) {
  return date.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
}

function getCurrentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function shuffleWithSeed<T>(items: T[], seedText: string) {
  const shuffled = [...items];
  let seed = hashDate(seedText) || 1;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const swapIndex = seed % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

function normalizeTaskTitle(task: string) {
  if (task === "记录睡眠时间") return "记录睡眠状态";
  if (task === "感到心慌时坐下等 2 分钟") return "感到心慌时安抚自己";
  if (task === "坐一次电梯/进一次商场") return "出门逛街/逛公园了";
  return task;
}

function getDailyTaskPool() {
  return Array.from(new Set([
    ...planMonths.flatMap((month) => month.tasks),
    ...extraDailyTaskCategories.flatMap((category) => category.tasks),
  ]));
}

function getTaskStatusLabels(task: string): TaskStatusLabels {
  const normalized = normalizeTaskTitle(task);
  return taskStatusLabelMap[normalized] ?? statusLabels;
}

function getTaskPlanGroup(task: string): PlanGroupKey {
  const normalized = normalizeTaskTitle(task);
  if (taskPlanGroupMap[normalized]) return taskPlanGroupMap[normalized];
  if (normalized.includes("开车") || normalized.includes("高速") || normalized.includes("路线")) return "trust";
  if (normalized.includes("体重") || normalized.includes("主食") || normalized.includes("蛋白质")) return "manage";
  return "noise";
}

function getTaskLabel(task: string) {
  const normalized = normalizeTaskTitle(task);
  if (taskLabelMap[normalized]) return taskLabelMap[normalized];
  if (normalized.includes("太阳")) return "晒太阳";
  if (normalized.includes("散步") || normalized.includes("快走") || normalized.includes("轻快走")) return "活动";
  if (normalized.includes("吃") || normalized.includes("主食") || normalized.includes("蛋白质")) return "吃饭";
  if (normalized.includes("灾难")) return "记录";
  if (normalized.includes("高速")) return "高速";
  if (normalized.includes("开车")) return "路线";
  if (normalized.includes("睡眠")) return "睡眠";
  if (normalized.includes("膝盖") || normalized.includes("椭圆机") || normalized.includes("骑车") || normalized.includes("游泳")) return "替代";
  return "一点点";
}

function getTaskNote(task: string) {
  const normalized = normalizeTaskTitle(task);
  if (taskNoteMap[normalized]) return taskNoteMap[normalized];
  if (normalized.includes("太阳")) return "站在窗边也可以，短短一会儿也算。";
  if (normalized.includes("散步") || normalized.includes("快走") || normalized.includes("轻快走")) return "不用走很远，身体愿意动一点就很好。";
  if (normalized.includes("三顿饭")) return "不是为了完美饮食，是让身体知道供应还在。";
  if (normalized.includes("灾难")) return "不是复盘对错，只是给大脑留一张证据。";
  if (isHighwayCommuteTask(normalized)) return "先走熟悉的高速路线，今天不用临时加难度。";
  if (normalized.includes("开车")) return "固定路线就够了，不需要临时加难度。";
  if (normalized.includes("睡眠")) return "只记录，不评价，先让身体被看见。";
  if (normalized.includes("蛋白质") || normalized.includes("主食")) return "温和调整，不取消、不惩罚。";
  if (normalized.includes("膝盖")) return "疼的时候换一种方式，照顾身体也算完成。";
  return "只做一点点，也可以被算作今天的恢复。";
}

function isHighwayCommuteTask(task: string) {
  return task.includes("上班") && task.includes("高速") && task.includes("开车");
}

function getDailyTasksForDate(date: string, savedTasks?: DailyTaskRecord[]) {
  if (savedTasks?.length === 3) return savedTasks.map(normalizeDailyTask);

  return getDefaultDailyTasksForDate(date);
}

function getDefaultDailyTasksForDate(date: string) {
  const taskPool = getDailyTaskPool();
  const seed = hashDate(date);
  const picked: string[] = [];
  let cursor = seed % taskPool.length;

  while (picked.length < 3 && picked.length < taskPool.length) {
    const task = taskPool[cursor % taskPool.length];
    if (!picked.includes(task)) picked.push(task);
    cursor += 3;
  }

  return buildDailyTaskRecords(date, picked);
}

function buildDailyTaskRecords(date: string, picked: string[]) {
  const tones: DailyTaskRecord["tone"][] = ["purple", "pink", "blue"];

  return picked.map((rawTitle, index) => {
    const title = normalizeTaskTitle(rawTitle);
    return {
      id: `${date}-${index}-${title}`,
      label: getTaskLabel(title),
      title,
      note: getTaskNote(title),
      tone: tones[index],
      status: "not_started" as TaskStatus,
      selected: false,
    };
  });
}

function getRandomTaskForSlot(date: string, slotIndex: number, currentTasks: DailyTaskRecord[]) {
  const taskPool = getDailyTaskPool();
  const currentTitles = currentTasks.map((task) => task.title);
  const candidates = taskPool.filter((task) => !currentTitles.includes(task));
  const pool = candidates.length > 0 ? candidates : taskPool;
  const title = normalizeTaskTitle(pool[Math.floor(Math.random() * pool.length)]);
  const tone = currentTasks[slotIndex]?.tone ?? (["purple", "pink", "blue"] as const)[slotIndex % 3];

  return {
    id: `${date}-random-${Date.now()}-${slotIndex}-${title}`,
    label: getTaskLabel(title),
    title,
    note: getTaskNote(title),
    tone,
    status: "not_started" as TaskStatus,
    selected: false,
  };
}

function normalizeDailyTask(task: DailyTaskRecord): DailyTaskRecord {
  const title = normalizeTaskTitle(task.title);
  return {
    ...task,
    title,
    label: getTaskLabel(title),
    note: getTaskNote(title),
    selected: task.selected ?? true,
  };
}

function createEmptyRecord(date = todayKey()): DailyRecoveryRecord {
  return {
    date,
    sunlightStatus: "not_started",
    walkStatus: "not_started",
    recordStatus: "not_started",
    dailyTasks: getDailyTasksForDate(date),
  };
}

function readRecords(): DailyRecoveryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecords(records: DailyRecoveryRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function mergeRecordIntoList(records: DailyRecoveryRecord[], record: DailyRecoveryRecord) {
  const nextRecords = records.some((item) => item.date === record.date)
    ? records.map((item) => (item.date === record.date ? record : item))
    : [record, ...records];

  return nextRecords.sort((a, b) => b.date.localeCompare(a.date));
}

function getTodayRecord() {
  const date = todayKey();
  const record = readRecords().find((item) => item.date === date) ?? createEmptyRecord(date);
  return {
    ...record,
    dailyTasks: getDailyTasksForDate(date, record.dailyTasks),
  };
}

function upsertRecord(record: DailyRecoveryRecord) {
  const records = readRecords();
  const nextRecords = mergeRecordIntoList(records, record);
  writeRecords(nextRecords);
  return record;
}

function deleteWorryRecord() {
  const record = getTodayRecord();
  const nextRecord = { ...record };
  delete nextRecord.worryRecord;
  upsertRecord(nextRecord);
  return nextRecord;
}

function deleteTodayDailyTasksRecord() {
  const record = getTodayRecord();
  const nextRecord: DailyRecoveryRecord = {
    ...record,
    sunlightStatus: "not_started",
    walkStatus: "not_started",
    recordStatus: record.worryRecord ? record.recordStatus : "not_started",
  };
  delete nextRecord.dailyTasks;
  delete nextRecord.dailyTasksSavedAt;
  upsertRecord(nextRecord);
  return nextRecord;
}

function getRecordTaskStatus(record: DailyRecoveryRecord, task: string) {
  const dynamicTask = record.dailyTasks?.find((item) => item.title === task);
  if (dynamicTask) return dynamicTask.status;
  if (task.includes("太阳")) return record.sunlightStatus;
  if (task.includes("散步") || task.includes("快走") || task.includes("轻快走")) return record.walkStatus;
  if (task.includes("灾难")) return record.recordStatus;
  return "not_started";
}

function RoundIcon({
  name,
  size = 24,
  filled = false,
}: {
  name: IconName;
  size?: number;
  filled?: boolean;
}) {
  const color = filled ? "#111111" : "currentColor";
  const fill = filled ? "#111111" : "none";
  const inner = filled ? "#ffffff" : "currentColor";
  const common = {
    fill,
    stroke: color,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
  };

  const iconContent: Record<IconName, ReactNode> = {
    home: (
      <>
        <path {...common} d="M4 11 12 4l8 7v8a2 2 0 0 1-2 2h-4v-6h-4v6H6a2 2 0 0 1-2-2Z" />
        {filled ? <path d="M10 21v-6h4v6" fill={inner} /> : null}
      </>
    ),
    book: (
      <>
        <rect {...common} x="5" y="4" width="14" height="17" rx="4" />
        <path d="M9 9h6M9 13h5" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    calendar: (
      <>
        <rect {...common} x="4" y="5" width="16" height="16" rx="4" />
        <path d="M8 3v4M16 3v4M7 10h10" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
        {filled ? <rect x="9" y="13" width="6" height="5" rx="2" fill={inner} /> : null}
      </>
    ),
    mic: (
      <>
        <rect {...common} x="9" y="4" width="6" height="10" rx="4" />
        <path d="M6 11a6 6 0 0 0 12 0M12 17v3M9 20h6" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    save: (
      <>
        <rect {...common} x="4" y="4" width="16" height="16" rx="4" />
        <path d="M8 4v6h8V4M8 20v-6h8v6" fill="none" stroke={inner} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </>
    ),
    sun: (
      <>
        <rect {...common} x="8" y="8" width="8" height="8" rx="4" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    footprints: (
      <>
        <rect {...common} x="6" y="4" width="5" height="8" rx="4" />
        <rect {...common} x="13" y="12" width="5" height="8" rx="4" />
        <path d="M7 15h2M15 8h2" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    water: (
      <>
        <path {...common} d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z" />
        <path d="M9 15a3 3 0 0 0 3 3" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    breath: (
      <>
        <path {...common} d="M4 8h8a3 3 0 1 0-3-3" />
        <path {...common} d="M4 13h13a3 3 0 1 1-3 3" />
        <path {...common} d="M4 18h6" />
      </>
    ),
    bath: (
      <>
        <path {...common} d="M5 12h14v2a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6Z" />
        <path {...common} d="M7 12V7a3 3 0 0 1 6 0v1" />
        <path d="M8 20v1M16 20v1" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    leaf: (
      <>
        <path {...common} d="M5 19c9 0 14-5 14-14-9 0-14 5-14 14Z" />
        <path d="M5 19 16 8" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    shoulder: (
      <>
        <path {...common} d="M8 7a4 4 0 0 1 8 0v2a4 4 0 0 1-8 0Z" />
        <path {...common} d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" />
        <path d="M7 16c2 2 8 2 10 0" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    calm: (
      <>
        <path {...common} d="M12 4a8 8 0 0 1 8 8c0 5-8 9-8 9s-8-4-8-9a8 8 0 0 1 8-8Z" />
        <path d="M8 12h8M9 15c2 2 4 2 6 0" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    utensils: (
      <>
        <path {...common} d="M7 3v8M4 3v8M10 3v8M4 8h6M7 11v10" />
        <path {...common} d="M17 3c2 2 3 5 2 9h-4c-1-4 0-7 2-9Zm0 9v9" />
      </>
    ),
    notebook: (
      <>
        <rect {...common} x="5" y="4" width="14" height="17" rx="4" />
        <path d="M9 8h6M9 12h4M9 16h5" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    refresh: (
      <>
        <path {...common} d="M19 12a7 7 0 1 1-2.05-4.95" />
        <path {...common} d="M19 5.2v4.2h-4.2" />
      </>
    ),
    car: (
      <>
        <path {...common} d="M5 12 7 7h10l2 5v5H5Z" />
        <path d="M7 17v2M17 17v2M7 12h10" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    moon: (
      <>
        <path {...common} d="M17 18a8 8 0 0 1-9.5-9.5A7 7 0 1 0 17 18Z" />
      </>
    ),
    sleep: (
      <>
        <path {...common} d="M5 16V8a3 3 0 0 1 3-3h3a3 3 0 0 1 3 3v8" />
        <path {...common} d="M3 16h18v4M6 20v-2M18 20v-2" />
        <path d="M8 9h4" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    phone: (
      <>
        <rect {...common} x="7" y="3" width="10" height="18" rx="4" />
        <path d="M10 6h4M11 17h2" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    bowl: (
      <>
        <path {...common} d="M5 11h14v2a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6Z" />
        <path {...common} d="M8 8c2-2 6-2 8 0" />
        <path d="M7 19h10" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    soup: (
      <>
        <path {...common} d="M5 11h14v3a6 6 0 0 1-6 6h-2a6 6 0 0 1-6-6Z" />
        <path d="M8 7c1-1 1-2 0-3M12 7c1-1 1-2 0-3M16 7c1-1 1-2 0-3" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    sprout: (
      <>
        <path {...common} d="M12 21V10" />
        <path {...common} d="M12 11C8 11 6 8 6 5c4 0 7 2 7 6" />
        <path {...common} d="M12 13c4 0 6-3 6-6-4 0-7 2-7 6" />
      </>
    ),
    bike: (
      <>
        <rect {...common} x="4" y="13" width="6" height="6" rx="4" />
        <rect {...common} x="14" y="13" width="6" height="6" rx="4" />
        <path d="M7 16h5l3-6h-3M12 16l-3-6h3" fill="none" stroke={inner} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
      </>
    ),
    stairs: (
      <>
        <path {...common} d="M4 19h5v-4h5v-4h6" />
        <path {...common} d="M6 8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
        <path {...common} d="M6 10v5" />
      </>
    ),
    search: (
      <>
        <rect {...common} x="4" y="5" width="13" height="13" rx="4" />
        <path d="m15 16 5 5M8 9h5M8 13h3" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    chat: (
      <>
        <path {...common} d="M5 5h14v10H9l-4 4Z" />
        <path d="M9 9h6M9 12h4" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    map: (
      <>
        <path {...common} d="M5 5 11 3l7 2v14l-7-2-6 2Z" />
        <path d="M11 3v14M18 5l-7 12" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    park: (
      <>
        <path {...common} d="M12 4 5 13h14Z" />
        <path {...common} d="M12 13v8" />
        <path d="M8 18h8" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    scale: (
      <>
        <rect {...common} x="5" y="4" width="14" height="16" rx="4" />
        <path d="M9 9a3 3 0 0 1 6 0M12 9l2-2" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    clothes: (
      <>
        <path {...common} d="M8 4 5 6l-2 5 4 2v7h10v-7l4-2-2-5-3-2a4 4 0 0 1-8 0Z" />
      </>
    ),
    mirror: (
      <>
        <rect {...common} x="7" y="3" width="10" height="14" rx="5" />
        <path {...common} d="M12 17v4M9 21h6" />
      </>
    ),
    broom: (
      <>
        <path {...common} d="M14 4 5 13" />
        <path {...common} d="M4 15 9 20l4-4-5-5Z" />
        <path d="M5 18h6" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    window: (
      <>
        <rect {...common} x="4" y="4" width="16" height="16" rx="4" />
        <path d="M12 4v16M4 12h16" fill="none" stroke={inner} strokeLinecap="round" strokeWidth="2" />
      </>
    ),
    waves: (
      <>
        <path {...common} d="M4 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
        <path {...common} d="M4 14c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
        <path {...common} d="M4 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      </>
    ),
    heart: (
      <>
        <path {...common} d="M12 20s-7-4.5-9-9a4.5 4.5 0 0 1 8-4 4.5 4.5 0 0 1 8 4c-2 4.5-9 9-9 9Z" />
      </>
    ),
  };

  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24">
      {iconContent[name]}
    </svg>
  );
}

const tabIcons = {
  home: { default: tabHomeIcon, selected: tabHomeIconSolid },
  record: { default: tabRecordIcon, selected: tabRecordIconSolid },
  plan: { default: tabPlanIcon, selected: tabPlanIconSolid },
} as const;

function TabIcon({ tab, selected }: { tab: "home" | "record" | "plan"; selected: boolean }) {
  const svg = (selected ? tabIcons[tab].selected : tabIcons[tab].default).replaceAll(/fill="#[A-Fa-f0-9]+"/g, 'fill="currentColor"');
  return (
    <span
      aria-hidden="true"
      className="tab-icon"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function getTaskIcon(task: string): IconName {
  const normalized = normalizeTaskTitle(task);
  const iconMap: Record<string, IconName> = {
    "晒太阳 10 分钟": "sun",
    "晚饭后散步 10-20 分钟": "footprints",
    "正常吃三顿饭": "utensils",
    "记录一个“没有发生的灾难”": "notebook",
    "每周 2 次轻快走 20-30 分钟": "footprints",
    "每周 1 次短途开车，固定路线": "car",
    "上班固定高速路线开车": "map",
    "记录睡眠状态": "moon",
    "每餐先吃蛋白质": "soup",
    "晚餐主食减半，但不取消": "bowl",
    "每周 3 次快走": "footprints",
    "膝盖疼时改为椭圆机/骑车/游泳": "bike",
    "喝一杯温水": "water",
    "做 3 次慢呼吸": "breath",
    "洗个热水澡/泡脚": "bath",
    "做一次护肤": "leaf",
    "给肩颈放松 3 分钟": "shoulder",
    "感到心慌时安抚自己": "calm",
    "睡前放下手机 10 分钟": "phone",
    "早点躺下但不强迫睡着": "sleep",
    "正常吃一份主食": "bowl",
    "吃一份蛋白质": "soup",
    "走到楼下再回来": "stairs",
    "不搜索身体症状": "search",
    "记录一次身体误报": "notebook",
    "给自己发一句安抚话": "chat",
    "今天允许自己慢一点": "heart",
    "开一小段熟悉路线": "map",
    "出门逛街/逛公园了": "park",
    "今天不称体重": "scale",
    "不因为体重少吃一顿": "utensils",
    "穿一件舒服的衣服": "clothes",
    "对镜子里的自己少批评一句": "mirror",
    "做一件不用表现的小事": "book",
    "整理一个小角落": "broom",
    "和一个安全的人说句话": "chat",
    "给今天留 10 分钟空白": "window",
  };

  if (iconMap[normalized]) return iconMap[normalized];
  if (normalized.includes("太阳")) return "sun";
  if (normalized.includes("散步") || normalized.includes("快走") || normalized.includes("轻快走")) return "footprints";
  if (normalized.includes("三顿饭")) return "utensils";
  if (normalized.includes("灾难")) return "notebook";
  if (normalized.includes("开车")) return "car";
  if (normalized.includes("睡眠")) return "moon";
  if (normalized.includes("蛋白质")) return "soup";
  if (normalized.includes("主食")) return "bowl";
  if (normalized.includes("椭圆机") || normalized.includes("骑车")) return "bike";
  if (normalized.includes("游泳")) return "waves";
  return "heart";
}

function isDailyTaskCounted(task: DailyTaskRecord) {
  const title = normalizeTaskTitle(task.title);
  const isSelected = task.selected ?? true;
  if (!isSelected) return false;
  if (task.status !== "not_started") return true;
  return countableNotStartedTasks.has(title);
}

function getMonthRecordStats(records: DailyRecoveryRecord[]) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const recordsThisMonth = records.filter((record) => record.date.startsWith(monthKey));
  const doneDays = recordsThisMonth.filter((record) => {
    return (
      (record.dailyTasks?.some(isDailyTaskCounted) ?? false) ||
      Boolean(record.worryRecord)
    );
  }).length;

  const bars = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const record = records.find((item) => item.date === key);
    if (!record) return { height: 8, hasValue: false };

    const score = (record.dailyTasks ?? []).filter(isDailyTaskCounted).length + (record.worryRecord ? 1 : 0);

    return {
      height: 8 + score * 10,
      hasValue: score > 0,
    };
  });

  return { doneDays, bars };
}

function getCurrentMonthRecords(records: DailyRecoveryRecord[]) {
  const monthKey = getCurrentMonthKey();
  return records.filter((record) => record.date.startsWith(monthKey));
}

function getPlanGuidanceTasks(groupKey: PlanGroupKey) {
  return shuffleWithSeed(planGuidanceTaskPool[groupKey], `${getCurrentMonthKey()}-${groupKey}`).slice(0, PLAN_TASK_DISPLAY_LIMIT);
}

function collectCompletedTaskTitles(record: DailyRecoveryRecord) {
  const completedTitles = new Set<string>();

  (record.dailyTasks ?? []).forEach((task) => {
    const title = normalizeTaskTitle(task.title);
    if (isDailyTaskCounted(task)) completedTitles.add(title);
  });

  if (!record.dailyTasks?.length) {
    if (record.sunlightStatus !== "not_started") completedTitles.add("晒太阳 10 分钟");
    if (record.walkStatus !== "not_started") completedTitles.add("晚饭后散步 10-20 分钟");
    if (record.recordStatus !== "not_started" || record.worryRecord) completedTitles.add("记录一个“没有发生的灾难”");
  } else if (record.worryRecord) {
    completedTitles.add("记录一个“没有发生的灾难”");
  }

  return completedTitles;
}

function getCurrentMonthTaskStats(records: DailyRecoveryRecord[]) {
  const counts = new Map<string, number>();

  getCurrentMonthRecords(records).forEach((record) => {
    collectCompletedTaskTitles(record).forEach((title) => {
      counts.set(title, (counts.get(title) ?? 0) + 1);
    });
  });

  return currentMonthPlanGroups.map((group) => {
    const completedTasks: MonthlyTaskStat[] = Array.from(counts.entries())
      .filter(([title]) => getTaskPlanGroup(title) === group.key)
      .map(([title, count]) => ({
        title,
        count,
        label: getTaskLabel(title),
        icon: getTaskIcon(title),
      }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "zh-Hans-CN"));
    const displayedTitles = new Set(completedTasks.map((task) => task.title));
    const guidanceTasks: MonthlyTaskStat[] = getPlanGuidanceTasks(group.key)
      .filter((title) => !displayedTitles.has(normalizeTaskTitle(title)))
      .map((title) => {
        const normalizedTitle = normalizeTaskTitle(title);
        return {
          title: normalizedTitle,
          count: 0,
          label: getTaskLabel(normalizedTitle),
          icon: getTaskIcon(normalizedTitle),
        };
      });
    const tasks = [...completedTasks, ...guidanceTasks].slice(0, PLAN_TASK_DISPLAY_LIMIT);

    return {
      ...group,
      tasks,
    };
  });
}

function recordHasRecoveryTrace(record: DailyRecoveryRecord) {
  return collectCompletedTaskTitles(record).size > 0 || Boolean(record.worryRecord);
}

function getRecordsInPlanHistoryRange(records: DailyRecoveryRecord[], range: PlanHistoryRange) {
  const start = getRangeStart(range);
  const end = new Date();

  return records.filter((record) => {
    const date = parseDateKey(record.date);
    return date >= start && date <= end;
  });
}

function getPlanHistoryTaskStats(records: DailyRecoveryRecord[], range: PlanHistoryRange) {
  const counts = new Map<string, number>();
  const rangeRecords = getRecordsInPlanHistoryRange(records, range);
  const totalDays = getTotalDaysInRange(range);

  rangeRecords.forEach((record) => {
    collectCompletedTaskTitles(record).forEach((title) => {
      counts.set(title, (counts.get(title) ?? 0) + 1);
    });
  });

  const tasks: PlanHistoryTaskStat[] = Array.from(counts.entries())
    .map(([title, count]) => ({
      title,
      count,
      label: getTaskLabel(title),
      icon: getTaskIcon(title),
      percentage: Math.min(100, Math.round((count / totalDays) * 100)),
    }))
    .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title, "zh-Hans-CN"));

  return {
    tasks,
    totalRecords: rangeRecords.length,
    activeDays: rangeRecords.filter(recordHasRecoveryTrace).length,
    totalDays,
  };
}

function getPreviousMonthSummary(records: DailyRecoveryRecord[]) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  const monthRecords = records.filter((record) => {
    const date = parseDateKey(record.date);
    return date >= start && date <= end;
  });
  const taskCounts = new Map<string, number>();

  monthRecords.forEach((record) => {
    collectCompletedTaskTitles(record).forEach((title) => {
      taskCounts.set(title, (taskCounts.get(title) ?? 0) + 1);
    });
  });

  return {
    activeDays: monthRecords.filter(recordHasRecoveryTrace).length,
    taskKinds: taskCounts.size,
  };
}

function getCurrentMonthTaskCompletionCount(task: string, records: DailyRecoveryRecord[]) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return records.filter((record) => {
    if (!record.date.startsWith(monthKey)) return false;
    return getRecordTaskStatus(record, task) !== "not_started";
  }).length;
}

function getTaskCardNote(task: string, records: DailyRecoveryRecord[]) {
  if (isHighwayCommuteTask(task) && getCurrentMonthTaskCompletionCount(task, records) >= 20) {
    return "如果今天状态还可以，可以比固定路线多一小段；不舒服就回到原路线。";
  }

  return getTaskNote(task);
}

function getPlanTaskTitle(title: string) {
  const planTitle = title.split("：")[1] ?? title;
  return planTitle.replace(/^先/, "");
}

function getTaskCompletionCount(task: string, records: DailyRecoveryRecord[]) {
  return records.filter((record) => {
    const dynamicStatus = getRecordTaskStatus(record, task);
    if (dynamicStatus !== "not_started") return true;
    if (task.includes("灾难")) {
      return record.recordStatus !== "not_started" || Boolean(record.worryRecord);
    }
    if (task.includes("睡眠")) return typeof record.energyLevel === "number";
    return false;
  }).length;
}

function PlanCat({ variant }: { variant: "sleep" | "trust" | "move" }) {
  const catImage = {
    sleep: planCatSleep,
    trust: planCatTrust,
    move: planCatMove,
  }[variant];

  return (
    <div className={`plan-cat plan-cat-${variant}`} aria-hidden="true">
      <img src={catImage} alt="" />
    </div>
  );
}

function Shell({
  activeTab,
  setActiveTab,
  children,
}: {
  activeTab: TabKey;
  setActiveTab: (tab: TabKey) => void;
  children: ReactNode;
}) {
  const tabs = [
    { key: "home", label: "首页" },
    { key: "record", label: "证据" },
    { key: "plan", label: "计划" },
  ] as const;

  return (
    <div className="app">
      <main className="page">{children}</main>
      <nav className="tabs">
        <div className="tabs-inner">
          {tabs.map(({ key, label }) => {
            const selected = activeTab === key || (key === "plan" && activeTab === "planHistory");
            return (
            <button
              className={`tab-button ${selected ? "selected" : ""}`}
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
            >
              <TabIcon tab={key} selected={selected} />
              <span>{label}</span>
            </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function PageHeader({ title, subtitle, large = false }: { title: string; subtitle?: string; large?: boolean }) {
  return (
    <header className={`page-header ${large ? "page-header-large" : ""}`}>
      <p>慢慢回来</p>
      <h1>{title}</h1>
      {subtitle ? <span>{subtitle}</span> : null}
    </header>
  );
}

function HomeHero() {
  return (
    <header className="home-hero">
      <div className="hero-copy">
        <p>慢慢回来</p>
        <h1>今日只做 3 件事</h1>
        <span>今天不用变好，只需要让身体知道：今天不是战场。</span>
      </div>
      <img src={petCat} alt="宠物陪伴" />
    </header>
  );
}

function HomePage({
  today,
  records,
  onSaveDailyTasks,
  openDailyHistory,
}: {
  today: DailyRecoveryRecord;
  records: DailyRecoveryRecord[];
  onSaveDailyTasks: (tasks: DailyTaskRecord[]) => void;
  openDailyHistory: () => void;
}) {
  const [draftTasks, setDraftTasks] = useState(() => getDefaultDailyTasksForDate(today.date));
  const [saveAnimationKey, setSaveAnimationKey] = useState(0);

  useEffect(() => {
    setDraftTasks(getDefaultDailyTasksForDate(today.date));
  }, [today.date]);

  const handleTaskChange = (taskId: string, status: TaskStatus) => {
    setDraftTasks((tasks) => tasks.map((task) => (task.id === taskId ? { ...task, status, selected: true } : task)));
  };

  const handleRefreshTask = (taskId: string) => {
    setDraftTasks((tasks) => {
      const taskIndex = tasks.findIndex((task) => task.id === taskId);
      if (taskIndex < 0) return tasks;
      return tasks.map((task, index) => (
        index === taskIndex ? getRandomTaskForSlot(today.date, index, tasks) : task
      ));
    });
  };

  const handleSaveTasks = () => {
    onSaveDailyTasks(draftTasks.map((task) => ({ ...task, selected: task.selected === true })));
    setDraftTasks(getDefaultDailyTasksForDate(today.date));
    setSaveAnimationKey((key) => key + 1);
  };

  return (
    <section>
      <HomeHero />
      <div className="task-toolbar">
        <span>今天派送这三件小事</span>
      </div>
      <div className="card-list">
        {draftTasks.map((task) => {
          const status = task.status;
          const hasSelection = task.selected === true;
          const taskStatusLabels = getTaskStatusLabels(task.title);
          return (
            <article className={`soft-card task-card tone-${task.tone}`} key={task.id}>
              <div className="card-title-row">
                <div>
                  <h2>{task.title}</h2>
                  <p>{getTaskCardNote(task.title, records)}</p>
                </div>
                <button
                  className="task-label-button"
                  type="button"
                  aria-label={`刷新${task.title}`}
                  onClick={() => handleRefreshTask(task.id)}
                >
                  <span>{task.label}</span>
                  <span
                    className="task-label-icon"
                    aria-hidden="true"
                    dangerouslySetInnerHTML={{ __html: refreshIcon.replaceAll(/fill="#[A-Fa-f0-9]+"/g, 'fill="currentColor"') }}
                  />
                </button>
              </div>
              <div className="status-grid">
                {(Object.keys(taskStatusLabels) as TaskStatus[]).map((item) => (
                  <button
                    className={`status-button ${hasSelection && status === item ? "selected" : ""}`}
                    key={item}
                    type="button"
                    onClick={() => handleTaskChange(task.id, item)}
                  >
                    {taskStatusLabels[item]}
                  </button>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      <div className="action-row">
        <button type="button" onClick={handleSaveTasks}>
          就这样
        </button>
        <button type="button" onClick={openDailyHistory}>
          查看以前
        </button>
      </div>
      {saveAnimationKey > 0 ? (
        <div className="save-fly-card" key={saveAnimationKey} aria-hidden="true">
          已放好
        </div>
      ) : null}
    </section>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  placeholder,
  inputRef,
  onFocus,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputRef?: Ref<HTMLTextAreaElement>;
  onFocus?: () => void;
  onBlur?: () => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea
        ref={inputRef}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={3}
      />
    </label>
  );
}

function RecordPage({
  today,
  onSave,
  onDelete,
  openEvidenceHistory,
}: {
  today: DailyRecoveryRecord;
  onSave: (record: WorryRecord) => void;
  onDelete: () => void;
  openEvidenceHistory: () => void;
}) {
  const existing = today.worryRecord;
  const [worry, setWorry] = useState(existing?.worry ?? "");
  const [bodyReaction, setBodyReaction] = useState(existing?.bodyReaction ?? "");
  const [actualResult, setActualResult] = useState<ActualResult>(existing?.actualResult ?? "没发生");
  const [selfHelpAction, setSelfHelpAction] = useState(existing?.selfHelpAction ?? "");
  const [messageToSelf, setMessageToSelf] = useState(existing?.messageToSelf ?? "");
  const [savedRecord, setSavedRecord] = useState<WorryRecord | undefined>(existing);
  const [isListening, setIsListening] = useState(false);
  const [voiceSheetOpen, setVoiceSheetOpen] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [focusedField, setFocusedField] = useState<VoiceTarget | null>(null);
  const [voiceTarget, setVoiceTarget] = useState<VoiceTarget>("worry");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const worryInputRef = useRef<HTMLTextAreaElement | null>(null);
  const voiceTextRef = useRef("");
  const interimTextRef = useRef("");
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const next = today.worryRecord;
    setWorry(next?.worry ?? "");
    setBodyReaction(next?.bodyReaction ?? "");
    setActualResult(next?.actualResult ?? "没发生");
    setSelfHelpAction(next?.selfHelpAction ?? "");
    setMessageToSelf(next?.messageToSelf ?? "");
    setSavedRecord(next);
  }, [today.date, today.worryRecord]);

  const evidence = useMemo(() => {
    const safeMessage = messageToSelf.trim() || DEFAULT_MESSAGE;
    if (actualResult === "今天还没法判断") {
      return `${safeMessage} 事情还没有答案，但我已经在照顾自己。`;
    }
    return `${safeMessage} 我担心的事和最后发生的事之间，有一点距离。`;
  }, [actualResult, messageToSelf]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const appendText = (current: string, text: string) => {
    const cleaned = text.trim();
    if (!cleaned) return current;
    return `${current}${current.trim() ? " " : ""}${cleaned}`;
  };

  const showToast = (message: string) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage("");
      toastTimerRef.current = null;
    }, 2200);
  };

  const stopListening = () => {
    const fallbackText = interimTextRef.current.trim();
    if (fallbackText) {
      setVoiceText((current) => {
        const next = appendText(current, fallbackText);
        voiceTextRef.current = next;
        return next;
      });
    }
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimText("");
    interimTextRef.current = "";
    showToast("录入已结束。可以点确定回填。");
  };

  const openVoiceSheet = () => {
    setVoiceSheetOpen(true);
    setVoiceText("");
    voiceTextRef.current = "";
    setInterimText("");
    interimTextRef.current = "";
  };

  const closeVoiceSheet = () => {
    if (isListening) stopListening();
    setVoiceSheetOpen(false);
  };

  const startVoiceRecording = () => {
    if (isListening) return;

    const SpeechRecognitionConstructor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionConstructor) {
      setVoiceSheetOpen(true);
      showToast("当前浏览器暂不支持语音识别，可以先用文字记录。");
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognitionRef.current = recognition;
    recognition.lang = "zh-CN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      showToast("正在听。慢慢说就好，松开按钮会停止。");
    };

    recognition.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += transcript;
        else interim += transcript;
      }
      if (finalText.trim()) {
        setVoiceText((current) => {
          const next = appendText(current, finalText);
          voiceTextRef.current = next;
          return next;
        });
      }
      const cleanedInterim = interim.trim();
      interimTextRef.current = cleanedInterim;
      setInterimText(cleanedInterim);
    };

    recognition.onerror = (event) => {
      const messages: Record<string, string> = {
        "not-allowed": "麦克风权限没有打开。允许后再试一次就好。",
        "no-speech": "刚才没有识别到声音，可以靠近一点再试。",
        "audio-capture": "没有检测到可用麦克风。",
      };
      showToast(messages[event.error] ?? "语音识别暂时中断了，可以再试一次。");
      setIsListening(false);
      setInterimText(interimTextRef.current);
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      if (interimTextRef.current.trim()) {
        setVoiceText((current) => {
          const next = appendText(current, interimTextRef.current);
          voiceTextRef.current = next;
          return next;
        });
        interimTextRef.current = "";
        setInterimText("");
      }
      recognitionRef.current = null;
    };

    recognition.start();
  };

  const fillVoiceText = () => {
    const text = appendText("", `${voiceTextRef.current} ${interimTextRef.current}`);
    if (!text) {
      showToast("还没有识别到内容，可以再长按说一次。");
      return;
    }

    const setters: Record<VoiceTarget, (value: string | ((current: string) => string)) => void> = {
      worry: setWorry,
      bodyReaction: setBodyReaction,
      selfHelpAction: setSelfHelpAction,
      messageToSelf: setMessageToSelf,
    };

    setters[voiceTarget]((current) => appendText(current, text));
    setVoiceSheetOpen(false);
    showToast(`已回填到「${voiceTargetLabels[voiceTarget]}」。`);
    setVoiceText("");
    voiceTextRef.current = "";
    setInterimText("");
    interimTextRef.current = "";
  };

  const resetVoiceText = () => {
    if (isListening) stopListening();
    setVoiceText("");
    voiceTextRef.current = "";
    setInterimText("");
    interimTextRef.current = "";
    showToast("已清空。可以重新长按录入。");
  };

  const handleFieldFocus = (target: VoiceTarget) => {
    setFocusedField(target);
    setVoiceTarget(target);
  };

  const handleSave = () => {
    const record: WorryRecord = {
      worry: worry.trim() || "今天没有写下具体担心，也可以。",
      bodyReaction: bodyReaction.trim() || "身体有点累，需要慢慢来。",
      actualResult,
      selfHelpAction: selfHelpAction.trim() || "我停下来观察了一下自己。",
      messageToSelf: messageToSelf.trim() || DEFAULT_MESSAGE,
      evidence,
    };
    onSave(record);
    setSavedRecord(record);
  };

  const handleDelete = () => {
    if (!window.confirm("确定删除今天这张证据卡吗？删除后，今天的文字记录会被清空。")) return;
    onDelete();
    setWorry("");
    setBodyReaction("");
    setActualResult("没发生");
    setSelfHelpAction("");
    setMessageToSelf("");
    setSavedRecord(undefined);
  };

  return (
    <section>
      <PageHeader title="今天有没有一件事，是你以为会很糟，但最后没有那么糟？" large />
      <button className="voice-button" type="button" onClick={openVoiceSheet}>
        <RoundIcon name="mic" size={18} />
        语音录入
      </button>
      {toastMessage ? <div className="app-toast" role="status">{toastMessage}</div> : null}
      <div className="form-card">
        <TextAreaField
          label="我今天担心了什么？"
          value={worry}
          onChange={setWorry}
          placeholder={focusedField === "worry" ? "" : "可以只写几个字。"}
          inputRef={worryInputRef}
          onFocus={() => handleFieldFocus("worry")}
          onBlur={() => setFocusedField(null)}
        />
        <TextAreaField
          label="当时身体有什么反应？"
          value={bodyReaction}
          onChange={setBodyReaction}
          placeholder={focusedField === "bodyReaction" ? "" : "比如心跳快、手麻、胃紧。"}
          onFocus={() => handleFieldFocus("bodyReaction")}
          onBlur={() => setFocusedField(null)}
        />
        <fieldset className="result-field">
          <legend>最后真的发生了吗？</legend>
          <div className="status-grid">
            {resultOptions.map((option) => (
              <button
                className={`status-button ${actualResult === option ? "selected" : ""}`}
                key={option}
                type="button"
                onClick={() => setActualResult(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
        <TextAreaField
          label="我做了什么帮助自己？"
          value={selfHelpAction}
          onChange={setSelfHelpAction}
          placeholder={focusedField === "selfHelpAction" ? "" : "喝水、坐下、走一小段、给朋友发消息，都算。"}
          onFocus={() => handleFieldFocus("selfHelpAction")}
          onBlur={() => setFocusedField(null)}
        />
        <TextAreaField
          label="给今天的自己一句话"
          value={messageToSelf}
          onChange={setMessageToSelf}
          placeholder={focusedField === "messageToSelf" ? "" : DEFAULT_MESSAGE}
          onFocus={() => handleFieldFocus("messageToSelf")}
          onBlur={() => setFocusedField(null)}
        />
        <button className="save-button" type="button" onClick={handleSave}>
          <RoundIcon name="save" size={18} />
          保存今日证据卡
        </button>
      </div>
      {savedRecord ? <EvidenceCard record={savedRecord} onDelete={handleDelete} /> : null}
      <button className="evidence-history-link" type="button" onClick={openEvidenceHistory}>
        <span>看以前的证据</span>
        <span aria-hidden="true">›</span>
      </button>
      {voiceSheetOpen ? (
        <VoiceSheet
          displayText={`${voiceText}${voiceText && interimText ? " " : ""}${interimText}`.trim()}
          isListening={isListening}
          targetLabel={voiceTargetLabels[voiceTarget]}
          onClose={closeVoiceSheet}
          onFill={fillVoiceText}
          onReset={resetVoiceText}
          onPressStart={startVoiceRecording}
          onPressEnd={stopListening}
        />
      ) : null}
    </section>
  );
}

function VoiceSheet({
  displayText,
  isListening,
  targetLabel,
  onClose,
  onFill,
  onReset,
  onPressStart,
  onPressEnd,
}: {
  displayText: string;
  isListening: boolean;
  targetLabel: string;
  onClose: () => void;
  onFill: () => void;
  onReset: () => void;
  onPressStart: () => void;
  onPressEnd: () => void;
}) {
  const handlePointerEnd = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    if (isListening) onPressEnd();
  };

  return (
    <div className="voice-sheet-wrap" role="dialog" aria-modal="true" aria-label="语音录入">
      <button className="voice-sheet-mask" type="button" aria-label="关闭语音录入" onClick={onClose} />
      <div className="voice-sheet">
        <div className="voice-sheet-header">
          <div>
            <p>语音录入</p>
            <span>回填到：{targetLabel}</span>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </div>
        <div className={`voice-live-text ${displayText ? "" : "empty"}`}>
          {displayText || "长按下方按钮，说出你想记录的话。"}
        </div>
        <button
          className={`voice-hold-button ${isListening ? "listening" : ""}`}
          type="button"
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            onPressStart();
          }}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onPointerLeave={() => {
            if (isListening) onPressEnd();
          }}
        >
          <RoundIcon name="mic" size={28} filled={isListening} />
          <span>{isListening ? "松开结束" : "按住说话"}</span>
        </button>
        <div className="voice-action-row">
          <button className="voice-reset-button" type="button" onClick={onReset}>
            重置
          </button>
          <button className="voice-fill-button" type="button" onClick={onFill}>
            确定
          </button>
        </div>
      </div>
    </div>
  );
}

function EvidenceCard({ record, onDelete }: { record: WorryRecord; onDelete: () => void }) {
  return (
    <article className="evidence-card">
      <div className="evidence-title-row">
        <h2>今日证据卡</h2>
        <button className="delete-button" type="button" onClick={onDelete}>
          删除
        </button>
      </div>
      <p><b>担心：</b>{record.worry}</p>
      <p><b>身体反应：</b>{record.bodyReaction}</p>
      <p><b>实际结果：</b>{record.actualResult}</p>
      <p><b>有效动作：</b>{record.selfHelpAction}</p>
      <p><b>今日证据：</b>{record.evidence}</p>
    </article>
  );
}

function PlanPage({
  records,
  openPlanHistory,
}: {
  records: DailyRecoveryRecord[];
  openPlanHistory: () => void;
}) {
  const stats = getMonthRecordStats(records);
  const monthlyGroups = getCurrentMonthTaskStats(records);

  return (
    <section>
      <PageHeader title={getCurrentMonthTitle()} subtitle="这里按这个月你真实做过的事来排，不是要你补作业。" />
      <div className="card-list">
        {monthlyGroups.map((group) => (
          <article className="soft-card plan-card" key={group.key}>
            <PlanCat variant={group.cat} />
            <div className="plan-copy">
              <div className="plan-title-stack">
                <h2>{group.title}</h2>
              </div>
              <p className="plan-subtitle">{group.tip}</p>
            </div>
            <h3>本月任务</h3>
            <ul className="plan-task-list">
              {group.tasks.map((task) => (
                <li key={task.title}>
                  <span className="plan-task-main">
                    <RoundIcon name={task.icon} size={17} />
                    <span>{task.title}</span>
                  </span>
                  <b>{task.count}</b>
                </li>
              ))}
            </ul>
            <div className="plan-chart" aria-label="当月完成记录情况">
              <div>
                <h3>当月完成记录情况</h3>
                <p>这个月已有 {stats.doneDays} 天留下恢复记录</p>
              </div>
              <div className="chart-bars">
                {stats.bars.map((bar, barIndex) => (
                  <span
                    key={`${group.key}-${barIndex}`}
                    className={bar.hasValue ? "has-value" : ""}
                    style={{ height: `${bar.height}px` }}
                  />
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
      <button className="plan-history-entry" type="button" onClick={openPlanHistory}>
        <span>
          <b>历史计划</b>
          <small>看看之前的恢复任务，哪些已经在慢慢变熟。</small>
        </span>
        <span aria-hidden="true">›</span>
      </button>
    </section>
  );
}

function PlanHistoryPage({ records }: { records: DailyRecoveryRecord[] }) {
  const [range, setRange] = useState<PlanHistoryRange>("month");
  const stats = getPlanHistoryTaskStats(records, range);

  return (
    <section>
      <PageHeader title="历史计划" subtitle="按任务看见恢复的痕迹，不分大类，也不用补齐任何一天。" />
      <div className="history-tabs" role="tablist" aria-label="历史计划时间维度">
        {planHistoryRangeOptions.map((option) => (
          <button
            className={range === option.key ? "selected" : ""}
            key={option.key}
            type="button"
            role="tab"
            aria-selected={range === option.key}
            onClick={() => setRange(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <article className="soft-card history-chart-card">
        <div className="history-chart-head">
          <div>
            <h2>{getRangeLabel(range)}任务分布</h2>
            <p>{stats.activeDays} 天有恢复记录，共记录 {stats.tasks.reduce((total, task) => total + task.count, 0)} 次任务。</p>
          </div>
        </div>
        {stats.tasks.length > 0 ? (
          <div className="history-task-chart">
            {stats.tasks.map((task) => (
              <div className="history-task-row" key={task.title}>
                <div className="history-task-title">
                  <RoundIcon name={task.icon} size={18} />
                  <span>{task.title}</span>
                  <b>{task.count}/{stats.totalDays}</b>
                </div>
                <div className="history-bar-track" aria-hidden="true">
                  <span style={{ width: `${task.percentage}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="history-empty">这个时间范围里还没有任务记录。空着也没关系，恢复本来就会有空白。</div>
        )}
      </article>
    </section>
  );
}

function DailyHistoryPage({
  records,
  onDeleteToday,
}: {
  records: DailyRecoveryRecord[];
  onDeleteToday: () => void;
}) {
  const items = records.filter((record) => record.dailyTasksSavedAt && record.dailyTasks?.length);
  const today = todayKey();

  const handleDeleteToday = () => {
    if (!window.confirm("确定删除今天这张每日三件事卡片吗？删除后，今天保存的三个选项会被清空。")) return;
    onDeleteToday();
  };

  return (
    <section>
      <PageHeader title="每日三件事" subtitle="这里记录的是你每天给身体留过的一点空间，不需要每天一样。" />
      {items.length === 0 ? (
        <div className="empty-card">还没有保存过每日三件事。点一次“就这样”，这里就会多一条记录。</div>
      ) : (
        <div className="card-list">
          {items.map((record) => (
            <article className="soft-card task-history-card" key={record.date}>
              <div className="task-history-title-row">
                <time>{record.date}</time>
                {record.date === today ? (
                  <button className="delete-button" type="button" onClick={handleDeleteToday}>
                    删除
                  </button>
                ) : null}
              </div>
              <div className="task-history-list">
                {record.dailyTasks?.map((task) => (
                  <div className={`task-history-item tone-${task.tone}`} key={task.id}>
                    <span>{task.title}</span>
                    <b>{task.selected === false ? "今天没选择" : getTaskStatusLabels(task.title)[task.status]}</b>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function EvidenceHistoryPage({ records }: { records: DailyRecoveryRecord[] }) {
  const items = records.filter((record) => record.worryRecord);
  return (
    <section>
      <PageHeader title="记录列表" subtitle="这里放的是身体慢慢学到的新证据，不需要每天都有。" />
      {items.length === 0 ? (
        <div className="empty-card">现在还没有证据卡。等你愿意写第一张的时候，它会出现在这里。</div>
      ) : (
        <div className="card-list">
          {items.map((record) => (
            <article className="soft-card" key={record.date}>
              <time>{record.date}</time>
              <p><b>担心：</b>{record.worryRecord?.worry}</p>
              <p><b>实际结果：</b>{record.worryRecord?.actualResult}</p>
              <p><b>今日证据：</b>{record.worryRecord?.evidence}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState<TabKey>("home");
  const [today, setToday] = useState<DailyRecoveryRecord>(() => getTodayRecord());
  const [records, setRecords] = useState(() => readRecords());
  const tabScrollPositionsRef = useRef<Partial<Record<TabKey, number>>>({ home: 0 });

  const switchTab = (tab: TabKey) => {
    if (tab === activeTab) {
      tabScrollPositionsRef.current[tab] = 0;
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return;
    }

    tabScrollPositionsRef.current[activeTab] = window.scrollY;
    const nextScrollTop = tabScrollPositionsRef.current[tab] ?? 0;

    setActiveTab(tab);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: nextScrollTop, left: 0, behavior: "auto" });
    });
  };

  const refresh = () => {
    setToday(getTodayRecord());
    setRecords(readRecords());
  };

  const handleSaveDailyTasks = (tasks: DailyTaskRecord[]) => {
    const current = getTodayRecord();
    const sunlightTask = tasks.find((task) => task.title.includes("太阳"));
    const walkTask = tasks.find((task) => task.title.includes("散步") || task.title.includes("快走") || task.title.includes("轻快走"));
    const evidenceTask = tasks.find((task) => task.title.includes("灾难"));

    const savedRecord = upsertRecord({
      ...current,
      sunlightStatus: sunlightTask?.status ?? current.sunlightStatus,
      walkStatus: walkTask?.status ?? current.walkStatus,
      recordStatus: evidenceTask?.status ?? current.recordStatus,
      dailyTasks: tasks,
      dailyTasksSavedAt: new Date().toISOString(),
    });

    setToday(savedRecord);
    setRecords((currentRecords) => mergeRecordIntoList(currentRecords, savedRecord));
  };

  const handleSaveWorry = (record: WorryRecord) => {
    const current = getTodayRecord();
    const savedRecord = upsertRecord({
      ...current,
      recordStatus: "done",
      dailyTasks: current.dailyTasks?.map((task) => (
        task.title.includes("灾难") ? { ...task, status: "done" } : task
      )),
      worryRecord: record,
    });

    setToday(savedRecord);
    setRecords((currentRecords) => mergeRecordIntoList(currentRecords, savedRecord));
  };

  const handleDeleteWorry = () => {
    deleteWorryRecord();
    refresh();
  };

  const handleDeleteTodayDailyTasks = () => {
    deleteTodayDailyTasksRecord();
    refresh();
  };

  return (
    <Shell activeTab={activeTab} setActiveTab={switchTab}>
      {activeTab === "home" ? (
        <HomePage
          today={today}
          records={records}
          onSaveDailyTasks={handleSaveDailyTasks}
          openDailyHistory={() => switchTab("dailyHistory")}
        />
      ) : null}
      {activeTab === "record" ? (
        <RecordPage
          today={today}
          onSave={handleSaveWorry}
          onDelete={handleDeleteWorry}
          openEvidenceHistory={() => switchTab("evidenceHistory")}
        />
      ) : null}
      {activeTab === "plan" ? (
        <PlanPage records={records} openPlanHistory={() => switchTab("planHistory")} />
      ) : null}
      {activeTab === "planHistory" ? <PlanHistoryPage records={records} /> : null}
      {activeTab === "dailyHistory" ? (
        <DailyHistoryPage records={records} onDeleteToday={handleDeleteTodayDailyTasks} />
      ) : null}
      {activeTab === "evidenceHistory" ? <EvidenceHistoryPage records={records} /> : null}
    </Shell>
  );
}
