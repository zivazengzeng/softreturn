import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, Ref } from "react";
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
type TabKey = "home" | "record" | "plan" | "dailyHistory" | "evidenceHistory";
type IconName =
  | "bike"
  | "book"
  | "calendar"
  | "car"
  | "footprints"
  | "heart"
  | "home"
  | "mic"
  | "moon"
  | "notebook"
  | "refresh"
  | "save"
  | "soup"
  | "sprout"
  | "sun"
  | "utensils"
  | "waves";

type ActualResult =
  | "没发生"
  | "发生了一点，但我处理了"
  | "发生了，但没有我想象中严重"
  | "今天还没法判断";

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

const resultOptions: ActualResult[] = [
  "没发生",
  "发生了一点，但我处理了",
  "发生了，但没有我想象中严重",
  "今天还没法判断",
];

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
    tasks: ["每周 2 次轻快走 20-30 分钟", "每周 1 次短途开车，固定路线", "上班固定高速路线开车", "记录睡眠时间"],
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

function todayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function hashDate(date: string) {
  return date.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
}

function getTaskLabel(task: string) {
  if (task.includes("太阳")) return "晒太阳";
  if (task.includes("散步") || task.includes("快走") || task.includes("轻快走")) return "活动";
  if (task.includes("吃") || task.includes("主食") || task.includes("蛋白质")) return "吃饭";
  if (task.includes("灾难")) return "记录";
  if (task.includes("高速")) return "高速";
  if (task.includes("开车")) return "路线";
  if (task.includes("睡眠")) return "睡眠";
  if (task.includes("膝盖") || task.includes("椭圆机") || task.includes("骑车") || task.includes("游泳")) return "替代";
  return "一点点";
}

function getTaskNote(task: string) {
  if (task.includes("太阳")) return "站在窗边也可以，短短一会儿也算。";
  if (task.includes("散步") || task.includes("快走") || task.includes("轻快走")) return "不用走很远，身体愿意动一点就很好。";
  if (task.includes("三顿饭")) return "不是为了完美饮食，是让身体知道供应还在。";
  if (task.includes("灾难")) return "不是复盘对错，只是给大脑留一张证据。";
  if (isHighwayCommuteTask(task)) return "先走熟悉的高速路线，今天不用临时加难度。";
  if (task.includes("开车")) return "固定路线就够了，不需要临时加难度。";
  if (task.includes("睡眠")) return "只记录，不评价，先让身体被看见。";
  if (task.includes("蛋白质") || task.includes("主食")) return "温和调整，不取消、不惩罚。";
  if (task.includes("膝盖")) return "疼的时候换一种方式，照顾身体也算完成。";
  return "只做一点点，也可以被算作今天的恢复。";
}

function isHighwayCommuteTask(task: string) {
  return task.includes("上班") && task.includes("高速") && task.includes("开车");
}

function getDailyTasksForDate(date: string, savedTasks?: DailyTaskRecord[]) {
  if (savedTasks?.length === 3) return savedTasks;

  const taskPool = Array.from(new Set(planMonths.flatMap((month) => month.tasks)));
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

  return picked.map((title, index) => ({
    id: `${date}-${index}-${title}`,
    label: getTaskLabel(title),
    title,
    note: getTaskNote(title),
    tone: tones[index],
    status: "not_started" as TaskStatus,
  }));
}

function getRandomTaskForSlot(date: string, slotIndex: number, currentTasks: DailyTaskRecord[]) {
  const taskPool = Array.from(new Set(planMonths.flatMap((month) => month.tasks)));
  const currentTitles = currentTasks.map((task) => task.title);
  const candidates = taskPool.filter((task) => !currentTitles.includes(task));
  const pool = candidates.length > 0 ? candidates : taskPool;
  const title = pool[Math.floor(Math.random() * pool.length)];
  const tone = currentTasks[slotIndex]?.tone ?? (["purple", "pink", "blue"] as const)[slotIndex % 3];

  return {
    id: `${date}-random-${Date.now()}-${slotIndex}-${title}`,
    label: getTaskLabel(title),
    title,
    note: getTaskNote(title),
    tone,
    status: "not_started" as TaskStatus,
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
  const nextRecords = records.some((item) => item.date === record.date)
    ? records.map((item) => (item.date === record.date ? record : item))
    : [record, ...records];

  writeRecords(nextRecords.sort((a, b) => b.date.localeCompare(a.date)));
  return record;
}

function deleteWorryRecord() {
  const record = getTodayRecord();
  const nextRecord = { ...record };
  delete nextRecord.worryRecord;
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
  const color = filled ? "#6440f4" : "currentColor";
  const fill = filled ? "#6440f4" : "none";
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
  if (task.includes("太阳")) return "sun";
  if (task.includes("散步") || task.includes("快走") || task.includes("轻快走")) return "footprints";
  if (task.includes("三顿饭")) return "utensils";
  if (task.includes("灾难")) return "notebook";
  if (task.includes("开车")) return "car";
  if (task.includes("睡眠")) return "moon";
  if (task.includes("蛋白质")) return "soup";
  if (task.includes("主食")) return "sprout";
  if (task.includes("椭圆机") || task.includes("骑车")) return "bike";
  if (task.includes("游泳")) return "waves";
  return "heart";
}

function getMonthRecordStats(records: DailyRecoveryRecord[]) {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const recordsThisMonth = records.filter((record) => record.date.startsWith(monthKey));
  const doneDays = recordsThisMonth.filter((record) => {
    return (
      (record.dailyTasks?.some((task) => task.status !== "not_started") ?? false) ||
      Boolean(record.worryRecord)
    );
  }).length;

  const bars = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (6 - index));
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const record = records.find((item) => item.date === key);
    if (!record) return { height: 8, hasValue: false };

    const score = (record.dailyTasks ?? []).filter((task) => task.status !== "not_started").length + (record.worryRecord ? 1 : 0);

    return {
      height: 8 + score * 10,
      hasValue: score > 0,
    };
  });

  return { doneDays, bars };
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
            const selected = activeTab === key;
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
  const [draftTasks, setDraftTasks] = useState(() => getDailyTasksForDate(today.date, today.dailyTasks));
  const [saveAnimationKey, setSaveAnimationKey] = useState(0);

  useEffect(() => {
    setDraftTasks(getDailyTasksForDate(today.date, today.dailyTasks));
  }, [today]);

  const handleTaskChange = (taskId: string, status: TaskStatus) => {
    setDraftTasks((tasks) => tasks.map((task) => (task.id === taskId ? { ...task, status } : task)));
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
    onSaveDailyTasks(draftTasks);
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
                {(Object.keys(statusLabels) as TaskStatus[]).map((item) => (
                  <button
                    className={`status-button ${status === item ? "selected" : ""}`}
                    key={item}
                    type="button"
                    onClick={() => handleTaskChange(task.id, item)}
                  >
                    {statusLabels[item]}
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
  const [interimText, setInterimText] = useState("");
  const [speechHint, setSpeechHint] = useState("点击后说出今天担心的事，会自动填到第一个输入框。");
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const worryInputRef = useRef<HTMLTextAreaElement | null>(null);

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

  const appendWorry = (text: string) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    setWorry((current) => `${current}${current.trim() ? " " : ""}${cleaned}`);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsListening(false);
    setInterimText("");
    setSpeechHint("语音录入已暂停。你可以继续手动修改文字。");
  };

  const handleVoiceInput = () => {
    if (isListening) {
      stopListening();
      return;
    }

    const SpeechRecognitionConstructor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionConstructor) {
      setSpeechHint("当前浏览器暂不支持语音识别，可以先用文字记录。");
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
      setSpeechHint("正在听。你可以慢慢说，不需要组织得很完整。");
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
      appendWorry(finalText);
      setInterimText(interim.trim());
    };

    recognition.onerror = (event) => {
      const messages: Record<string, string> = {
        "not-allowed": "麦克风权限没有打开。允许后再试一次就好。",
        "no-speech": "刚才没有识别到声音，可以靠近一点再试。",
        "audio-capture": "没有检测到可用麦克风。",
      };
      setSpeechHint(messages[event.error] ?? "语音识别暂时中断了，可以再试一次。");
      setIsListening(false);
      setInterimText("");
      recognitionRef.current = null;
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimText("");
      recognitionRef.current = null;
    };

    recognition.start();
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
      <button className={`voice-button ${isListening ? "listening" : ""}`} type="button" onClick={handleVoiceInput}>
        <RoundIcon name="mic" size={18} />
        {isListening ? "正在听，点这里停止" : "语音录入"}
      </button>
      <div className="speech-hint">
        <p>{speechHint}</p>
        {interimText ? <span>正在识别：{interimText}</span> : null}
      </div>
      <div className="form-card">
        <TextAreaField
          label="我今天担心了什么？"
          value={worry}
          onChange={setWorry}
          placeholder={focusedField === "worry" ? "" : "可以只写几个字。"}
          inputRef={worryInputRef}
          onFocus={() => setFocusedField("worry")}
          onBlur={() => setFocusedField(null)}
        />
        <TextAreaField
          label="当时身体有什么反应？"
          value={bodyReaction}
          onChange={setBodyReaction}
          placeholder={focusedField === "bodyReaction" ? "" : "比如心跳快、手麻、胃紧。"}
          onFocus={() => setFocusedField("bodyReaction")}
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
          onFocus={() => setFocusedField("selfHelpAction")}
          onBlur={() => setFocusedField(null)}
        />
        <TextAreaField
          label="给今天的自己一句话"
          value={messageToSelf}
          onChange={setMessageToSelf}
          placeholder={focusedField === "messageToSelf" ? "" : DEFAULT_MESSAGE}
          onFocus={() => setFocusedField("messageToSelf")}
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
    </section>
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

function PlanPage({ records }: { records: DailyRecoveryRecord[] }) {
  const stats = getMonthRecordStats(records);

  return (
    <section>
      <PageHeader title="3个月计划" subtitle="计划只是扶手，不是考卷。每个月只要朝身体多靠近一点点。" />
      <div className="card-list">
        {planMonths.map((month, index) => (
          <article className="soft-card plan-card" key={month.title}>
            <PlanCat variant={month.cat} />
            <div className="plan-copy">
              <div className="plan-title-stack">
                <h2>{getPlanTaskTitle(month.title)}</h2>
              </div>
              <p className="plan-subtitle">{month.tip}</p>
            </div>
            <h3>需做的任务</h3>
            <ul className="plan-task-list">
              {month.tasks.map((task) => (
                <li key={task}>
                  <span className="plan-task-main">
                    <RoundIcon name={getTaskIcon(task)} size={17} />
                    <span>{task}</span>
                  </span>
                  <b>{getTaskCompletionCount(task, records)}</b>
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
                    key={`${month.title}-${barIndex}`}
                    className={bar.hasValue ? "has-value" : ""}
                    style={{ height: `${bar.height}px` }}
                  />
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function DailyHistoryPage({ records }: { records: DailyRecoveryRecord[] }) {
  const items = records.filter((record) => record.dailyTasksSavedAt && record.dailyTasks?.length);
  return (
    <section>
      <PageHeader title="每日三件事" subtitle="这里记录的是你每天给身体留过的一点空间，不需要每天一样。" />
      {items.length === 0 ? (
        <div className="empty-card">还没有保存过每日三件事。点一次“就这样”，这里就会多一条记录。</div>
      ) : (
        <div className="card-list">
          {items.map((record) => (
            <article className="soft-card task-history-card" key={record.date}>
              <time>{record.date}</time>
              <div className="task-history-list">
                {record.dailyTasks?.map((task) => (
                  <div className={`task-history-item tone-${task.tone}`} key={task.id}>
                    <span>{task.title}</span>
                    <b>{statusLabels[task.status]}</b>
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

  const refresh = () => {
    setToday(getTodayRecord());
    setRecords(readRecords());
  };

  const handleSaveDailyTasks = (tasks: DailyTaskRecord[]) => {
    const current = getTodayRecord();
    const sunlightTask = tasks.find((task) => task.title.includes("太阳"));
    const walkTask = tasks.find((task) => task.title.includes("散步") || task.title.includes("快走") || task.title.includes("轻快走"));
    const evidenceTask = tasks.find((task) => task.title.includes("灾难"));

    setToday(upsertRecord({
      ...current,
      sunlightStatus: sunlightTask?.status ?? current.sunlightStatus,
      walkStatus: walkTask?.status ?? current.walkStatus,
      recordStatus: evidenceTask?.status ?? current.recordStatus,
      dailyTasks: tasks,
      dailyTasksSavedAt: new Date().toISOString(),
    }));
    setRecords(readRecords());
  };

  const handleSaveWorry = (record: WorryRecord) => {
    const current = getTodayRecord();
    upsertRecord({
      ...current,
      recordStatus: "done",
      dailyTasks: current.dailyTasks?.map((task) => (
        task.title.includes("灾难") ? { ...task, status: "done" } : task
      )),
      worryRecord: record,
    });
    refresh();
  };

  const handleDeleteWorry = () => {
    deleteWorryRecord();
    refresh();
  };

  return (
    <Shell activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === "home" ? (
        <HomePage
          today={today}
          records={records}
          onSaveDailyTasks={handleSaveDailyTasks}
          openDailyHistory={() => setActiveTab("dailyHistory")}
        />
      ) : null}
      {activeTab === "record" ? (
        <RecordPage
          today={today}
          onSave={handleSaveWorry}
          onDelete={handleDeleteWorry}
          openEvidenceHistory={() => setActiveTab("evidenceHistory")}
        />
      ) : null}
      {activeTab === "plan" ? <PlanPage records={records} /> : null}
      {activeTab === "dailyHistory" ? <DailyHistoryPage records={records} /> : null}
      {activeTab === "evidenceHistory" ? <EvidenceHistoryPage records={records} /> : null}
    </Shell>
  );
}
