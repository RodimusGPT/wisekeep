// WiseKeep Process Recording Edge Function
// Handles transcription and summarization via Groq API
// Supports chunked audio for long recordings (1+ hours)
// API key is securely stored in Supabase environment variables

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Types
interface AudioChunk {
  url: string;
  startTime: number;
  endTime: number;
  index: number;
}

interface ProcessRequest {
  recording_id: string;
  user_id: string;
  audio_chunks: AudioChunk[]; // Array of chunks (single item for small recordings)
  language: string;
  duration_seconds: number;
}

interface UsageCheck {
  allowed: boolean;
  tier: string;
  minutes_used: number;
  minutes_limit: number;
  period_type: string;
}

// New comprehensive usage interface
interface ComprehensiveUsage {
  tier: string;
  can_record: boolean;
  can_process: boolean;
  ai_minutes_used: number;
  ai_minutes_limit: number;
  ai_minutes_remaining: number;
  storage_used: number;
  storage_limit: number;
  storage_remaining: number;
  period_start: string;
}

interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

interface TranscriptionResult {
  text: string;
  segments?: TranscriptionSegment[];
}

interface NoteItem {
  id: string;
  timestamp: number;
  text: string;
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Comprehensive Simplified to Traditional Chinese character mappings
// Extended mapping covering ~500+ high-frequency characters that differ between the two
const simplifiedToTraditional: Record<string, string> = {
  // Common verb/action words
  '说': '說', '话': '話', '语': '語', '请': '請', '谢': '謝',
  '认': '認', '识': '識', '让': '讓', '应': '應', '会': '會',
  '这': '這', '里': '裡', '么': '麼', '对': '對', '关': '關',
  '开': '開', '门': '門', '问': '問', '听': '聽', '见': '見',
  '观': '觀', '视': '視', '读': '讀', '写': '寫', '学': '學',
  '习': '習', '练': '練', '经': '經', '济': '濟', '过': '過',
  '时': '時', '间': '間', '现': '現', '发': '發', '动': '動',
  '机': '機', '电': '電', '脑': '腦', '网': '網', '络': '絡',
  '统': '統', '计': '計', '设': '設', '备': '備', '术': '術',
  '专': '專', '业': '業', '务': '務', '产': '產', '为': '為',
  '与': '與', '并': '並', '从': '從', '进': '進', '还': '還',
  '车': '車', '东': '東', '国': '國', '际': '際', '华': '華',
  '万': '萬', '亿': '億', '数': '數', '据': '據', '报': '報',
  '导': '導', '团': '團', '队': '隊', '组': '組', '织': '織',
  '个': '個', '们': '們', '体': '體', '质': '質', '种': '種',
  '类': '類', '头': '頭', '长': '長', '张': '張', '场': '場',
  '厂': '廠', '广': '廣', '边': '邊', '远': '遠', '运': '運',
  '输': '輸', '连': '連', '结': '結', '构': '構', '来': '來',
  '变': '變', '样': '樣', '标': '標', '准': '準', '规': '規',
  '则': '則', '条': '條', '双': '雙', '单': '單', '简': '簡',
  '复': '復', '杂': '雜', '难': '難', '几': '幾', '医': '醫',
  '药': '藥', '钱': '錢', '银': '銀', '货': '貨', '买': '買',
  '卖': '賣', '价': '價', '贵': '貴', '营': '營', '销': '銷',
  '费': '費', '资': '資', '风': '風', '险': '險', '证': '證',
  '实': '實', '验': '驗', '测': '測', '试': '試', '确': '確',
  '后': '後', '节': '節', '点': '點', '线': '線',

  // Additional high-frequency characters
  '爱': '愛', '碍': '礙', '肮': '骯', '袄': '襖', '坝': '壩',
  '罢': '罷', '摆': '擺', '败': '敗', '颁': '頒', '办': '辦',
  '帮': '幫', '绑': '綁', '镑': '鎊', '谤': '謗', '剥': '剝',
  '饱': '飽', '宝': '寶', '报': '報', '币': '幣', '毕': '畢',
  '毙': '斃', '闭': '閉', '边': '邊', '编': '編', '贬': '貶',
  '辩': '辯', '辫': '辮', '标': '標', '表': '錶', '别': '彆',
  '宾': '賓', '滨': '濱', '补': '補', '参': '參', '蚕': '蠶',
  '残': '殘', '惭': '慚', '惨': '慘', '灿': '燦', '苍': '蒼',
  '舱': '艙', '仓': '倉', '沧': '滄', '厕': '廁', '侧': '側',
  '册': '冊', '测': '測', '层': '層', '诧': '詫', '搀': '攙',
  '谗': '讒', '馋': '饞', '缠': '纏', '铲': '鏟', '产': '產',
  '阐': '闡', '颤': '顫', '场': '場', '尝': '嘗', '偿': '償',
  '肠': '腸', '厂': '廠', '畅': '暢', '钞': '鈔', '车': '車',
  '彻': '徹', '尘': '塵', '陈': '陳', '衬': '襯', '撑': '撐',
  '称': '稱', '惩': '懲', '诚': '誠', '骋': '騁', '迟': '遲',
  '驰': '馳', '齿': '齒', '冲': '衝', '虫': '蟲', '宠': '寵',
  '畴': '疇', '筹': '籌', '丑': '醜', '橱': '櫥', '厨': '廚',
  '锄': '鋤', '础': '礎', '储': '儲', '触': '觸', '处': '處',
  '传': '傳', '疮': '瘡', '闯': '闖', '创': '創', '锤': '錘',
  '纯': '純', '绰': '綽', '辞': '辭', '词': '詞', '赐': '賜',
  '聪': '聰', '葱': '蔥', '囱': '囪', '从': '從', '丛': '叢',
  '凑': '湊', '窜': '竄', '达': '達', '带': '帶', '担': '擔',
  '胆': '膽', '惮': '憚', '诞': '誕', '弹': '彈', '当': '當',
  '挡': '擋', '党': '黨', '荡': '蕩', '档': '檔', '捣': '搗',
  '岛': '島', '祷': '禱', '导': '導', '盗': '盜', '灯': '燈',
  '邓': '鄧', '敌': '敵', '涤': '滌', '递': '遞', '缔': '締',
  '颠': '顛', '点': '點', '垫': '墊', '电': '電', '淀': '澱',
  '钓': '釣', '调': '調', '谍': '諜', '叠': '疊', '钉': '釘',
  '顶': '頂', '锭': '錠', '订': '訂', '丢': '丟', '东': '東',
  '动': '動', '栋': '棟', '冻': '凍', '斗': '鬥', '犊': '犢',
  '独': '獨', '读': '讀', '赌': '賭', '镀': '鍍', '锻': '鍛',
  '断': '斷', '缎': '緞', '兑': '兌', '队': '隊', '对': '對',
  '吨': '噸', '顿': '頓', '钝': '鈍', '夺': '奪', '堕': '墮',
  '鹅': '鵝', '额': '額', '讹': '訛', '恶': '惡', '饿': '餓',
  '儿': '兒', '尔': '爾', '饵': '餌', '贰': '貳', '发': '發',
  '罚': '罰', '阀': '閥', '法': '法', '帆': '帆', '番': '番',
  '翻': '翻', '矾': '礬', '烦': '煩', '范': '範', '贩': '販',
  '饭': '飯', '访': '訪', '纺': '紡', '飞': '飛', '诽': '誹',
  '废': '廢', '费': '費', '纷': '紛', '坟': '墳', '奋': '奮',
  '愤': '憤', '粪': '糞', '丰': '豐', '枫': '楓', '锋': '鋒',
  '风': '風', '疯': '瘋', '冯': '馮', '缝': '縫', '讽': '諷',
  '凤': '鳳', '肤': '膚', '辐': '輻', '抚': '撫', '辅': '輔',
  '赋': '賦', '负': '負', '讣': '訃', '附': '附', '妇': '婦',
  '缚': '縛', '复': '復', '赴': '赴', '副': '副', '傅': '傅',
  '富': '富', '腹': '腹', '覆': '覆', '该': '該', '盖': '蓋',
  '干': '乾', '赶': '趕', '秆': '稈', '赣': '贛', '冈': '岡',
  '刚': '剛', '钢': '鋼', '纲': '綱', '岗': '崗', '杠': '槓',
  '镐': '鎬', '搞': '搞', '稿': '稿', '告': '告', '哥': '哥',
  '鸽': '鴿', '搁': '擱', '阁': '閣', '铬': '鉻', '个': '個',
  '给': '給', '根': '根', '跟': '跟', '亘': '亙', '更': '更',
  '耿': '耿', '工': '工', '攻': '攻', '功': '功', '贡': '貢',
  '钩': '鈎', '沟': '溝', '构': '構', '购': '購', '够': '夠',
  '估': '估', '姑': '姑', '孤': '孤', '辜': '辜', '菇': '菇',
  '古': '古', '股': '股', '骨': '骨', '谷': '穀', '顾': '顧',
  '雇': '僱', '固': '固', '故': '故', '刮': '刮', '瓜': '瓜',
  '挂': '掛', '乖': '乖', '怪': '怪', '关': '關', '观': '觀',
  '官': '官', '冠': '冠', '馆': '館', '管': '管', '贯': '貫',
  '惯': '慣', '灌': '灌', '罐': '罐', '广': '廣', '归': '歸',
  '龟': '龜', '规': '規', '轨': '軌', '鬼': '鬼', '诡': '詭',
  '柜': '櫃', '贵': '貴', '刽': '劊', '滚': '滾', '棍': '棍',
  '锅': '鍋', '国': '國', '果': '果', '裹': '裹', '过': '過',
  '骸': '骸', '骇': '駭', '韩': '韓', '含': '含', '涵': '涵',
  '寒': '寒', '函': '函', '罕': '罕', '翰': '翰', '汉': '漢',
  '汗': '汗', '旱': '旱', '捍': '捍', '悍': '悍', '焊': '焊',
  '憾': '憾', '撼': '撼', '航': '航', '毫': '毫', '豪': '豪',
  '壕': '壕', '浩': '浩', '耗': '耗', '号': '號', '呵': '呵',
  '核': '核', '何': '何', '合': '合', '和': '和', '河': '河',
  '贺': '賀', '赫': '赫', '鹤': '鶴', '黑': '黑', '痕': '痕',
  '很': '很', '狠': '狠', '恨': '恨', '亨': '亨', '横': '橫',
  '衡': '衡', '轰': '轟', '哄': '哄', '烘': '烘', '红': '紅',
  '宏': '宏', '洪': '洪', '鸿': '鴻', '侯': '侯', '猴': '猴',
  '吼': '吼', '后': '後', '厚': '厚', '候': '候', '呼': '呼',
  '忽': '忽', '狐': '狐', '胡': '胡', '湖': '湖', '糊': '糊',
  '虎': '虎', '互': '互', '户': '戶', '护': '護', '沪': '滬',
  '花': '花', '华': '華', '哗': '嘩', '滑': '滑', '画': '畫',
  '划': '劃', '话': '話', '怀': '懷', '槐': '槐', '徊': '徊',
  '坏': '壞', '欢': '歡', '环': '環', '还': '還', '缓': '緩',
  '换': '換', '患': '患', '唤': '喚', '焕': '煥', '涣': '渙',
  '宦': '宦', '幻': '幻', '荒': '荒', '慌': '慌', '皇': '皇',
  '黄': '黃', '煌': '煌', '凰': '凰', '惶': '惶', '晃': '晃',
  '谎': '謊', '灰': '灰', '挥': '揮', '辉': '輝', '恢': '恢',
  '回': '回', '悔': '悔', '毁': '毀', '汇': '匯', '会': '會',
  '讳': '諱', '烩': '燴', '贿': '賄', '秽': '穢', '绘': '繪',
  '荟': '薈', '昏': '昏', '婚': '婚', '浑': '渾', '魂': '魂',
  '混': '混', '豁': '豁', '活': '活', '火': '火', '伙': '夥',
  '或': '或', '货': '貨', '祸': '禍', '惑': '惑', '霍': '霍',
  '击': '擊', '机': '機', '肌': '肌', '鸡': '雞', '积': '積',
  '饥': '飢', '迹': '跡', '基': '基', '绩': '績', '激': '激',
  '及': '及', '吉': '吉', '级': '級', '极': '極', '即': '即',
  '急': '急', '疾': '疾', '集': '集', '籍': '籍', '几': '幾',
  '己': '己', '挤': '擠', '脊': '脊', '计': '計', '记': '記',
  '纪': '紀', '忌': '忌', '技': '技', '际': '際', '剂': '劑',
  '季': '季', '既': '既', '济': '濟', '继': '繼', '寄': '寄',
  '加': '加', '家': '家', '佳': '佳', '嘉': '嘉', '夹': '夾',
  '颊': '頰', '贾': '賈', '甲': '甲', '价': '價', '驾': '駕',
  '嫁': '嫁', '歼': '殲', '监': '監', '坚': '堅', '尖': '尖',
  '笺': '箋', '间': '間', '艰': '艱', '缄': '緘', '茧': '繭',
  '拣': '揀', '俭': '儉', '柬': '柬', '检': '檢', '减': '減',
  '剪': '剪', '简': '簡', '碱': '鹼', '见': '見', '件': '件',
  '建': '建', '剑': '劍', '荐': '薦', '贱': '賤', '健': '健',
  '舰': '艦', '渐': '漸', '践': '踐', '鉴': '鑒', '键': '鍵',
  '箭': '箭', '江': '江', '姜': '薑', '将': '將', '浆': '漿',
  '僵': '僵', '疆': '疆', '讲': '講', '奖': '獎', '桨': '槳',
  '酱': '醬', '降': '降', '蕉': '蕉', '交': '交', '郊': '郊',
  '浇': '澆', '娇': '嬌', '骄': '驕', '胶': '膠', '焦': '焦',
  '礁': '礁', '角': '角', '脚': '腳', '搅': '攪', '缴': '繳',
  '绞': '絞', '饺': '餃', '矫': '矯', '侥': '僥', '叫': '叫',
  '轿': '轎', '较': '較', '教': '教', '阶': '階', '皆': '皆',
  '接': '接', '揭': '揭', '街': '街', '节': '節', '劫': '劫',
  '杰': '傑', '洁': '潔', '结': '結', '截': '截', '竭': '竭',
  '姐': '姐', '解': '解', '介': '介', '界': '界', '届': '屆',
  '借': '借', '疥': '疥', '诫': '誡', '届': '届', '巾': '巾',
  '今': '今', '金': '金', '津': '津', '筋': '筋', '仅': '僅',
  '紧': '緊', '锦': '錦', '谨': '謹', '尽': '盡', '劲': '勁',
  '进': '進', '近': '近', '晋': '晉', '浸': '浸', '禁': '禁',
  '京': '京', '经': '經', '茎': '莖', '惊': '驚', '晶': '晶',
  '睛': '睛', '精': '精', '鲸': '鯨', '井': '井', '颈': '頸',
  '景': '景', '警': '警', '净': '淨', '径': '徑', '竞': '競',
  '竟': '竟', '敬': '敬', '境': '境', '静': '靜', '镜': '鏡',
  '纠': '糾', '究': '究', '鸠': '鳩', '九': '九', '久': '久',
  '酒': '酒', '旧': '舊', '救': '救', '就': '就', '舅': '舅',
  '居': '居', '拘': '拘', '狙': '狙', '驹': '駒', '菊': '菊',
  '局': '局', '矩': '矩', '举': '舉', '巨': '巨', '拒': '拒',
  '具': '具', '俱': '俱', '剧': '劇', '据': '據', '距': '距',
  '惧': '懼', '聚': '聚', '捐': '捐', '娟': '娟', '卷': '卷',
  '倦': '倦', '眷': '眷', '绢': '絹', '决': '決', '诀': '訣',
  '绝': '絕', '倔': '倔', '掘': '掘', '崛': '崛', '爵': '爵',
  '觉': '覺', '军': '軍', '君': '君', '均': '均', '菌': '菌',
  '俊': '俊', '峻': '峻', '卡': '卡', '咖': '咖', '开': '開',
  '凯': '凱', '慨': '慨', '刊': '刊', '堪': '堪', '勘': '勘',
  '坎': '坎', '砍': '砍', '看': '看', '康': '康', '慷': '慷',
  '糠': '糠', '扛': '扛', '抗': '抗', '炕': '炕', '考': '考',
  '拷': '拷', '烤': '烤', '靠': '靠', '科': '科', '棵': '棵',
  '颗': '顆', '壳': '殼', '咳': '咳', '可': '可', '渴': '渴',
  '克': '克', '刻': '刻', '客': '客', '课': '課', '肯': '肯',
  '垦': '墾', '恳': '懇', '啃': '啃', '坑': '坑', '空': '空',
  '孔': '孔', '控': '控', '抠': '摳', '口': '口', '扣': '扣',
  '寇': '寇', '枯': '枯', '哭': '哭', '窟': '窟', '苦': '苦',
  '库': '庫', '裤': '褲', '酷': '酷', '夸': '誇', '跨': '跨',
  '挎': '挎', '块': '塊', '快': '快', '宽': '寬', '款': '款',
  '匡': '匡', '筐': '筐', '狂': '狂', '况': '況', '旷': '曠',
  '矿': '礦', '框': '框', '眶': '眶', '亏': '虧', '盔': '盔',
  '窥': '窺', '馈': '饋', '愧': '愧', '溃': '潰', '昆': '昆',
  '捆': '捆', '困': '困', '扩': '擴', '括': '括', '阔': '闊',
  '垃': '垃', '拉': '拉', '喇': '喇', '蜡': '蠟', '腊': '臘',
  '辣': '辣', '啦': '啦', '莱': '萊', '来': '來', '赖': '賴',
  '兰': '蘭', '拦': '攔', '栏': '欄', '婪': '婪', '澜': '瀾',
  '蓝': '藍', '篮': '籃', '览': '覽', '懒': '懶', '烂': '爛',
  '滥': '濫', '琅': '琅', '郎': '郎', '狼': '狼', '廊': '廊',
  '朗': '朗', '浪': '浪', '捞': '撈', '劳': '勞', '牢': '牢',
  '老': '老', '姥': '姥', '涝': '澇', '乐': '樂', '勒': '勒',
  '雷': '雷', '镭': '鐳', '蕾': '蕾', '磊': '磊', '垒': '壘',
  '类': '類', '泪': '淚', '累': '累', '冷': '冷', '愣': '愣',
  '厘': '釐', '梨': '梨', '犁': '犁', '黎': '黎', '篱': '籬',
  '狸': '狸', '离': '離', '礼': '禮', '李': '李', '里': '裡',
  '理': '理', '鲤': '鯉', '力': '力', '历': '歷', '立': '立',
  '丽': '麗', '利': '利', '励': '勵', '例': '例', '隶': '隸',
  '栗': '栗', '砾': '礫', '荔': '荔', '连': '連', '帘': '簾',
  '怜': '憐', '莲': '蓮', '联': '聯', '廉': '廉', '镰': '鐮',
  '脸': '臉', '练': '練', '炼': '煉', '恋': '戀', '链': '鏈',
  '良': '良', '凉': '涼', '梁': '樑', '粮': '糧', '两': '兩',
  '亮': '亮', '谅': '諒', '辆': '輛', '量': '量', '晾': '晾',
  '聊': '聊', '疗': '療', '辽': '遼', '寥': '寥', '料': '料',
  '猎': '獵', '邻': '鄰', '林': '林', '临': '臨', '淋': '淋',
  '凛': '凜', '赁': '賃', '吝': '吝', '拎': '拎', '灵': '靈',
  '玲': '玲', '凌': '凌', '铃': '鈴', '陵': '陵', '羚': '羚',
  '零': '零', '龄': '齡', '领': '領', '岭': '嶺', '令': '令',
  '另': '另', '溜': '溜', '刘': '劉', '流': '流', '留': '留',
  '榴': '榴', '瘤': '瘤', '柳': '柳', '六': '六', '龙': '龍',
  '笼': '籠', '聋': '聾', '隆': '隆', '垄': '壟', '拢': '攏',
  '陇': '隴', '楼': '樓', '搂': '摟', '漏': '漏', '露': '露',
  '卢': '盧', '炉': '爐', '虏': '虜', '鲁': '魯', '陆': '陸',
  '录': '錄', '鹿': '鹿', '禄': '祿', '路': '路', '驴': '驢',
  '吕': '呂', '铝': '鋁', '侣': '侶', '旅': '旅', '虑': '慮',
  '律': '律', '率': '率', '绿': '綠', '滤': '濾', '乱': '亂',
  '掠': '掠', '略': '略', '轮': '輪', '伦': '倫', '仑': '崙',
  '沦': '淪', '纶': '綸', '论': '論', '罗': '羅', '萝': '蘿',
  '逻': '邏', '锣': '鑼', '箩': '籮', '骡': '騾', '螺': '螺',
  '裸': '裸', '洛': '洛', '络': '絡', '骆': '駱', '落': '落',
  '妈': '媽', '麻': '麻', '马': '馬', '玛': '瑪', '码': '碼',
  '蚂': '螞', '骂': '罵', '吗': '嗎', '埋': '埋', '买': '買',
  '迈': '邁', '麦': '麥', '卖': '賣', '脉': '脈', '蛮': '蠻',
  '满': '滿', '漫': '漫', '慢': '慢', '忙': '忙', '盲': '盲',
  '茫': '茫', '猫': '貓', '毛': '毛', '矛': '矛', '茅': '茅',
  '锚': '錨', '冒': '冒', '贸': '貿', '帽': '帽', '貌': '貌',
  '么': '麼', '没': '沒', '眉': '眉', '媒': '媒', '煤': '煤',
  '梅': '梅', '霉': '黴', '每': '每', '美': '美', '妹': '妹',
  '门': '門', '闷': '悶', '们': '們', '萌': '萌', '蒙': '蒙',
  '盟': '盟', '猛': '猛', '梦': '夢', '孟': '孟', '弥': '彌',
  '迷': '迷', '谜': '謎', '米': '米', '泌': '泌', '秘': '秘',
  '密': '密', '蜜': '蜜', '眠': '眠', '绵': '綿', '棉': '棉',
  '免': '免', '勉': '勉', '面': '面', '苗': '苗', '描': '描',
  '瞄': '瞄', '秒': '秒', '妙': '妙', '庙': '廟', '灭': '滅',
  '蔑': '蔑', '民': '民', '敏': '敏', '名': '名', '明': '明',
  '鸣': '鳴', '铭': '銘', '命': '命', '谬': '謬', '摸': '摸',
  '模': '模', '膜': '膜', '磨': '磨', '摩': '摩', '魔': '魔',
  '抹': '抹', '末': '末', '沫': '沫', '莫': '莫', '漠': '漠',
  '墨': '墨', '默': '默', '谋': '謀', '牟': '牟', '某': '某',
  '母': '母', '拇': '拇', '牡': '牡', '姆': '姆', '亩': '畝',
  '木': '木', '目': '目', '牧': '牧', '募': '募', '幕': '幕',
  '慕': '慕', '暮': '暮', '穆': '穆', '拿': '拿', '哪': '哪',
  '钠': '鈉', '那': '那', '娜': '娜', '纳': '納', '乃': '乃',
  '奶': '奶', '耐': '耐', '男': '男', '南': '南', '难': '難',
  '囊': '囊', '恼': '惱', '脑': '腦', '闹': '鬧', '呢': '呢',
  '内': '內', '嫩': '嫩', '能': '能', '尼': '尼', '泥': '泥',
  '你': '你', '逆': '逆', '溺': '溺', '年': '年', '念': '念',
  '娘': '娘', '酿': '釀', '鸟': '鳥', '尿': '尿', '捏': '捏',
  '聂': '聶', '涅': '涅', '您': '您', '宁': '寧', '凝': '凝',
  '拧': '擰', '狞': '獰', '牛': '牛', '扭': '扭', '纽': '紐',
  '农': '農', '浓': '濃', '弄': '弄', '奴': '奴', '努': '努',
  '怒': '怒', '女': '女', '暖': '暖', '挪': '挪', '诺': '諾',
  '欧': '歐', '殴': '毆', '鸥': '鷗', '呕': '嘔', '偶': '偶',
  '藕': '藕', '爬': '爬', '帕': '帕', '怕': '怕', '拍': '拍',
  '排': '排', '牌': '牌', '派': '派', '攀': '攀', '盘': '盤',
  '判': '判', '叛': '叛', '盼': '盼', '庞': '龐', '旁': '旁',
  '胖': '胖', '抛': '拋', '泡': '泡', '跑': '跑', '炮': '炮',
  '陪': '陪', '培': '培', '赔': '賠', '配': '配', '佩': '佩',
  '喷': '噴', '盆': '盆', '朋': '朋', '鹏': '鵬', '彭': '彭',
  '蓬': '蓬', '膨': '膨', '捧': '捧', '碰': '碰', '批': '批',
  '披': '披', '劈': '劈', '皮': '皮', '疲': '疲', '脾': '脾',
  '匹': '匹', '痞': '痞', '僻': '僻', '屁': '屁', '譬': '譬',
  '篇': '篇', '偏': '偏', '片': '片', '骗': '騙', '漂': '漂',
  '飘': '飄', '票': '票', '撇': '撇', '拼': '拼', '贫': '貧',
  '品': '品', '聘': '聘', '平': '平', '坪': '坪', '苹': '蘋',
  '萍': '萍', '评': '評', '凭': '憑', '瓶': '瓶', '屏': '屏',
  '坡': '坡', '泼': '潑', '颇': '頗', '婆': '婆', '迫': '迫',
  '破': '破', '魄': '魄', '剖': '剖', '扑': '撲', '铺': '鋪',
  '葡': '葡', '朴': '樸', '浦': '浦', '谱': '譜', '普': '普',
  '曝': '曝', '七': '七', '柒': '柒', '妻': '妻', '栖': '棲',
  '戚': '戚', '期': '期', '欺': '欺', '漆': '漆', '齐': '齊',
  '其': '其', '奇': '奇', '歧': '歧', '祈': '祈', '祁': '祁',
  '骑': '騎', '棋': '棋', '旗': '旗', '企': '企', '启': '啟',
  '岂': '豈', '起': '起', '气': '氣', '弃': '棄', '汽': '汽',
  '器': '器', '契': '契', '千': '千', '迁': '遷', '签': '簽',
  '牵': '牽', '铅': '鉛', '谦': '謙', '乾': '乾', '钱': '錢',
  '钳': '鉗', '前': '前', '潜': '潛', '浅': '淺', '遣': '遣',
  '欠': '欠', '歉': '歉', '枪': '槍', '呛': '嗆', '腔': '腔',
  '墙': '牆', '强': '強', '抢': '搶', '悄': '悄', '桥': '橋',
  '乔': '喬', '侨': '僑', '巧': '巧', '俏': '俏', '翘': '翹',
  '切': '切', '茄': '茄', '且': '且', '窃': '竊', '亲': '親',
  '琴': '琴', '禽': '禽', '勤': '勤', '芹': '芹', '青': '青',
  '轻': '輕', '倾': '傾', '清': '清', '蜻': '蜻', '情': '情',
  '晴': '晴', '擎': '擎', '请': '請', '庆': '慶', '穷': '窮',
  '丘': '丘', '邱': '邱', '球': '球', '求': '求', '囚': '囚',
  '秋': '秋', '区': '區', '曲': '曲', '躯': '軀', '驱': '驅',
  '屈': '屈', '渠': '渠', '取': '取', '娶': '娶', '趣': '趣',
  '去': '去', '圈': '圈', '权': '權', '全': '全', '泉': '泉',
  '拳': '拳', '犬': '犬', '劝': '勸', '券': '券', '缺': '缺',
  '却': '卻', '雀': '雀', '确': '確', '鹊': '鵲', '群': '群',
  '然': '然', '燃': '燃', '染': '染', '让': '讓', '饶': '饒',
  '扰': '擾', '绕': '繞', '惹': '惹', '热': '熱', '人': '人',
  '仁': '仁', '忍': '忍', '刃': '刃', '认': '認', '任': '任',
  '韧': '韌', '扔': '扔', '仍': '仍', '日': '日', '绒': '絨',
  '荣': '榮', '融': '融', '熔': '熔', '容': '容', '溶': '溶',
  '蓉': '蓉', '榕': '榕', '柔': '柔', '揉': '揉', '肉': '肉',
  '如': '如', '儒': '儒', '乳': '乳', '辱': '辱', '入': '入',
  '褥': '褥', '软': '軟', '瑞': '瑞', '锐': '銳', '润': '潤',
  '弱': '弱', '撒': '撒', '洒': '灑', '萨': '薩', '塞': '塞',
  '赛': '賽', '三': '三', '伞': '傘', '散': '散', '桑': '桑',
  '嗓': '嗓', '丧': '喪', '扫': '掃', '嫂': '嫂', '色': '色',
  '森': '森', '僧': '僧', '杀': '殺', '沙': '沙', '纱': '紗',
  '砂': '砂', '傻': '傻', '啥': '啥', '筛': '篩', '晒': '曬',
  '山': '山', '删': '刪', '杉': '杉', '珊': '珊', '闪': '閃',
  '陕': '陝', '扇': '扇', '善': '善', '伤': '傷', '商': '商',
  '赏': '賞', '上': '上', '尚': '尚', '裳': '裳', '梢': '梢',
  '烧': '燒', '稍': '稍', '少': '少', '绍': '紹', '哨': '哨',
  '舌': '舌', '蛇': '蛇', '舍': '捨', '设': '設', '社': '社',
  '射': '射', '摄': '攝', '涉': '涉', '赦': '赦', '申': '申',
  '伸': '伸', '身': '身', '深': '深', '神': '神', '沈': '沈',
  '审': '審', '婶': '嬸', '肾': '腎', '甚': '甚', '渗': '滲',
  '慎': '慎', '升': '升', '生': '生', '声': '聲', '牲': '牲',
  '胜': '勝', '绳': '繩', '省': '省', '盛': '盛', '剩': '剩',
  '圣': '聖', '师': '師', '诗': '詩', '狮': '獅', '施': '施',
  '湿': '濕', '十': '十', '什': '什', '石': '石', '时': '時',
  '识': '識', '实': '實', '食': '食', '史': '史', '使': '使',
  '始': '始', '驶': '駛', '示': '示', '士': '士', '世': '世',
  '市': '市', '事': '事', '势': '勢', '试': '試', '饰': '飾',
  '视': '視', '适': '適', '释': '釋', '是': '是', '誓': '誓',
  '收': '收', '手': '手', '守': '守', '首': '首', '寿': '壽',
  '受': '受', '兽': '獸', '授': '授', '售': '售', '瘦': '瘦',
  '书': '書', '殊': '殊', '舒': '舒', '叔': '叔', '疏': '疏',
  '输': '輸', '蔬': '蔬', '熟': '熟', '暑': '暑', '署': '署',
  '属': '屬', '鼠': '鼠', '数': '數', '术': '術', '束': '束',
  '述': '述', '树': '樹', '竖': '豎', '恕': '恕', '刷': '刷',
  '耍': '耍', '帅': '帥', '摔': '摔', '衰': '衰', '甩': '甩',
  '双': '雙', '霜': '霜', '爽': '爽', '谁': '誰', '水': '水',
  '税': '稅', '睡': '睡', '顺': '順', '说': '說', '硕': '碩',
  '斯': '斯', '司': '司', '丝': '絲', '私': '私', '思': '思',
  '撕': '撕', '死': '死', '四': '四', '寺': '寺', '似': '似',
  '饲': '飼', '肆': '肆', '松': '鬆', '耸': '聳', '宋': '宋',
  '送': '送', '颂': '頌', '诵': '誦', '搜': '搜', '艘': '艘',
  '苏': '蘇', '俗': '俗', '诉': '訴', '肃': '肅', '素': '素',
  '速': '速', '宿': '宿', '塑': '塑', '酸': '酸', '蒜': '蒜',
  '算': '算', '虽': '雖', '随': '隨', '髓': '髓', '岁': '歲',
  '穗': '穗', '碎': '碎', '隧': '隧', '孙': '孫', '损': '損',
  '笋': '筍', '缩': '縮', '所': '所', '索': '索', '锁': '鎖',
  '他': '他', '她': '她', '它': '它', '塔': '塔', '踏': '踏',
  '台': '臺', '抬': '抬', '泰': '泰', '态': '態', '太': '太',
  '贪': '貪', '摊': '攤', '滩': '灘', '坛': '壇', '檀': '檀',
  '谈': '談', '潭': '潭', '弹': '彈', '叹': '嘆', '炭': '炭',
  '探': '探', '碳': '碳', '汤': '湯', '唐': '唐', '堂': '堂',
  '塘': '塘', '糖': '糖', '躺': '躺', '趟': '趟', '烫': '燙',
  '涛': '濤', '逃': '逃', '桃': '桃', '陶': '陶', '淘': '淘',
  '讨': '討', '套': '套', '特': '特', '疼': '疼', '腾': '騰',
  '藤': '藤', '梯': '梯', '踢': '踢', '提': '提', '题': '題',
  '体': '體', '替': '替', '天': '天', '添': '添', '甜': '甜',
  '田': '田', '填': '填', '挑': '挑', '条': '條', '跳': '跳',
  '贴': '貼', '铁': '鐵', '厅': '廳', '听': '聽', '廷': '廷',
  '停': '停', '亭': '亭', '庭': '庭', '挺': '挺', '艇': '艇',
  '通': '通', '同': '同', '桐': '桐', '铜': '銅', '童': '童',
  '统': '統', '桶': '桶', '痛': '痛', '偷': '偷', '头': '頭',
  '投': '投', '透': '透', '凸': '凸', '突': '突', '图': '圖',
  '徒': '徒', '途': '途', '涂': '塗', '屠': '屠', '土': '土',
  '吐': '吐', '兔': '兔', '团': '團', '推': '推', '腿': '腿',
  '退': '退', '吞': '吞', '屯': '屯', '托': '託', '拖': '拖',
  '脱': '脫', '驼': '駝', '妥': '妥', '拓': '拓', '唾': '唾',
  '挖': '挖', '哇': '哇', '瓦': '瓦', '袜': '襪', '歪': '歪',
  '外': '外', '弯': '彎', '湾': '灣', '玩': '玩', '顽': '頑',
  '丸': '丸', '完': '完', '碗': '碗', '挽': '挽', '晚': '晚',
  '皖': '皖', '惋': '惋', '宛': '宛', '婉': '婉', '万': '萬',
  '腕': '腕', '汪': '汪', '王': '王', '亡': '亡', '网': '網',
  '往': '往', '枉': '枉', '妄': '妄', '忘': '忘', '望': '望',
  '危': '危', '威': '威', '微': '微', '为': '為', '围': '圍',
  '违': '違', '维': '維', '伟': '偉', '伪': '偽', '尾': '尾',
  '纬': '緯', '委': '委', '卫': '衛', '未': '未', '位': '位',
  '味': '味', '畏': '畏', '胃': '胃', '谓': '謂', '喂': '餵',
  '魏': '魏', '温': '溫', '文': '文', '闻': '聞', '蚊': '蚊',
  '稳': '穩', '问': '問', '翁': '翁', '窝': '窩', '我': '我',
  '沃': '沃', '卧': '臥', '握': '握', '乌': '烏', '污': '污',
  '呜': '嗚', '巫': '巫', '屋': '屋', '无': '無', '吴': '吳',
  '吾': '吾', '芜': '蕪', '梧': '梧', '五': '五', '午': '午',
  '伍': '伍', '武': '武', '舞': '舞', '侮': '侮', '务': '務',
  '物': '物', '误': '誤', '悟': '悟', '雾': '霧', '西': '西',
  '吸': '吸', '希': '希', '昔': '昔', '析': '析', '息': '息',
  '牺': '犧', '悉': '悉', '惜': '惜', '稀': '稀', '膝': '膝',
  '溪': '溪', '锡': '錫', '熙': '熙', '嘻': '嘻', '习': '習',
  '席': '席', '袭': '襲', '喜': '喜', '戏': '戲', '系': '系',
  '细': '細', '隙': '隙', '虾': '蝦', '瞎': '瞎', '霞': '霞',
  '下': '下', '吓': '嚇', '夏': '夏', '仙': '仙', '先': '先',
  '纤': '纖', '掀': '掀', '鲜': '鮮', '闲': '閒', '弦': '弦',
  '贤': '賢', '咸': '鹹', '涎': '涎', '嫌': '嫌', '衔': '銜',
  '显': '顯', '险': '險', '现': '現', '县': '縣', '限': '限',
  '线': '線', '宪': '憲', '陷': '陷', '献': '獻', '腺': '腺',
  '乡': '鄉', '相': '相', '香': '香', '厢': '廂', '湘': '湘',
  '箱': '箱', '详': '詳', '祥': '祥', '翔': '翔', '享': '享',
  '响': '響', '想': '想', '向': '向', '巷': '巷', '象': '象',
  '项': '項', '橡': '橡', '消': '消', '萧': '蕭', '硝': '硝',
  '销': '銷', '小': '小', '晓': '曉', '孝': '孝', '效': '效',
  '笑': '笑', '校': '校', '些': '些', '楔': '楔', '歇': '歇',
  '蝎': '蠍', '协': '協', '胁': '脅', '挟': '挾', '携': '攜',
  '斜': '斜', '谐': '諧', '写': '寫', '泄': '洩', '泻': '瀉',
  '卸': '卸', '屑': '屑', '谢': '謝', '心': '心', '辛': '辛',
  '欣': '欣', '新': '新', '薪': '薪', '馨': '馨', '信': '信',
  '兴': '興', '星': '星', '猩': '猩', '腥': '腥', '刑': '刑',
  '形': '形', '型': '型', '醒': '醒', '杏': '杏', '幸': '幸',
  '性': '性', '姓': '姓', '凶': '兇', '匈': '匈', '兄': '兄',
  '胸': '胸', '雄': '雄', '熊': '熊', '休': '休', '修': '修',
  '羞': '羞', '朽': '朽', '秀': '秀', '袖': '袖', '绣': '繡',
  '虚': '虛', '需': '需', '须': '須', '徐': '徐', '许': '許',
  '叙': '敘', '序': '序', '畜': '畜', '绪': '緒', '续': '續',
  '蓄': '蓄', '宣': '宣', '玄': '玄', '悬': '懸', '旋': '旋',
  '选': '選', '癣': '癬', '炫': '炫', '绚': '絢', '靴': '靴',
  '学': '學', '穴': '穴', '雪': '雪', '血': '血', '勋': '勳',
  '熏': '燻', '循': '循', '巡': '巡', '训': '訓', '讯': '訊',
  '逊': '遜', '迅': '迅', '压': '壓', '鸦': '鴉', '呀': '呀',
  '牙': '牙', '芽': '芽', '崖': '崖', '哑': '啞', '雅': '雅',
  '亚': '亞', '讶': '訝', '烟': '煙', '淹': '淹', '盐': '鹽',
  '严': '嚴', '言': '言', '岩': '岩', '沿': '沿', '炎': '炎',
  '研': '研', '颜': '顏', '阎': '閻', '延': '延', '眼': '眼',
  '演': '演', '厌': '厭', '宴': '宴', '艳': '艷', '验': '驗',
  '燕': '燕', '雁': '雁', '央': '央', '秧': '秧', '杨': '楊',
  '扬': '揚', '羊': '羊', '阳': '陽', '洋': '洋', '仰': '仰',
  '养': '養', '样': '樣', '漾': '漾', '邀': '邀', '腰': '腰',
  '妖': '妖', '遥': '遙', '摇': '搖', '姚': '姚', '咬': '咬',
  '药': '藥', '要': '要', '钥': '鑰', '耀': '耀', '爷': '爺',
  '野': '野', '也': '也', '冶': '冶', '业': '業', '叶': '葉',
  '页': '頁', '夜': '夜', '液': '液', '一': '一', '伊': '伊',
  '衣': '衣', '医': '醫', '依': '依', '仪': '儀', '夷': '夷',
  '宜': '宜', '姨': '姨', '移': '移', '遗': '遺', '疑': '疑',
  '乙': '乙', '已': '已', '以': '以', '矣': '矣', '蚁': '蟻',
  '椅': '椅', '义': '義', '亿': '億', '忆': '憶', '艺': '藝',
  '议': '議', '亦': '亦', '异': '異', '抑': '抑', '易': '易',
  '役': '役', '译': '譯', '益': '益', '逸': '逸', '意': '意',
  '毅': '毅', '翼': '翼', '因': '因', '阴': '陰', '音': '音',
  '殷': '殷', '吟': '吟', '银': '銀', '引': '引', '隐': '隱',
  '印': '印', '应': '應', '英': '英', '婴': '嬰', '鹰': '鷹',
  '樱': '櫻', '莹': '瑩', '萤': '螢', '营': '營', '蝇': '蠅',
  '赢': '贏', '盈': '盈', '影': '影', '映': '映', '硬': '硬',
  '拥': '擁', '庸': '庸', '雍': '雍', '踊': '踴', '永': '永',
  '咏': '詠', '泳': '泳', '勇': '勇', '涌': '湧', '用': '用',
  '优': '優', '忧': '憂', '幽': '幽', '悠': '悠', '尤': '尤',
  '由': '由', '油': '油', '游': '遊', '友': '友', '有': '有',
  '又': '又', '右': '右', '幼': '幼', '诱': '誘', '于': '於',
  '予': '予', '余': '餘', '鱼': '魚', '娱': '娛', '渔': '漁',
  '与': '與', '屿': '嶼', '宇': '宇', '语': '語', '羽': '羽',
  '玉': '玉', '雨': '雨', '域': '域', '遇': '遇', '喻': '喻',
  '御': '御', '裕': '裕', '育': '育', '预': '預', '欲': '欲',
  '狱': '獄', '誉': '譽', '浴': '浴', '寓': '寓', '冤': '冤',
  '渊': '淵', '元': '元', '园': '園', '员': '員', '原': '原',
  '圆': '圓', '援': '援', '缘': '緣', '源': '源', '远': '遠',
  '怨': '怨', '院': '院', '愿': '願', '约': '約', '月': '月',
  '岳': '嶽', '阅': '閱', '越': '越', '跃': '躍', '钥': '鑰',
  '云': '雲', '匀': '勻', '允': '允', '陨': '隕', '运': '運',
  '蕴': '蘊', '韵': '韻', '孕': '孕', '杂': '雜', '砸': '砸',
  '灾': '災', '栽': '栽', '载': '載', '宰': '宰', '再': '再',
  '在': '在', '咱': '咱', '赞': '讚', '脏': '髒', '葬': '葬',
  '遭': '遭', '凿': '鑿', '早': '早', '枣': '棗', '澡': '澡',
  '灶': '灶', '躁': '躁', '造': '造', '则': '則', '泽': '澤',
  '责': '責', '择': '擇', '贼': '賊', '怎': '怎', '曾': '曾',
  '赠': '贈', '扎': '扎', '渣': '渣', '闸': '閘', '眨': '眨',
  '炸': '炸', '诈': '詐', '摘': '摘', '斋': '齋', '宅': '宅',
  '窄': '窄', '债': '債', '寨': '寨', '沾': '沾', '盏': '盞',
  '斩': '斬', '辗': '輾', '崭': '嶄', '展': '展', '占': '占',
  '战': '戰', '站': '站', '湛': '湛', '绽': '綻', '章': '章',
  '彰': '彰', '张': '張', '掌': '掌', '涨': '漲', '丈': '丈',
  '仗': '仗', '帐': '帳', '账': '賬', '胀': '脹', '障': '障',
  '招': '招', '昭': '昭', '找': '找', '沼': '沼', '赵': '趙',
  '照': '照', '罩': '罩', '兆': '兆', '召': '召', '遮': '遮',
  '折': '折', '哲': '哲', '者': '者', '这': '這', '浙': '浙',
  '针': '針', '侦': '偵', '珍': '珍', '真': '真', '诊': '診',
  '镇': '鎮', '阵': '陣', '振': '振', '震': '震', '争': '爭',
  '征': '徵', '挣': '掙', '睁': '睜', '蒸': '蒸', '整': '整',
  '正': '正', '证': '證', '郑': '鄭', '政': '政', '症': '症',
  '之': '之', '支': '支', '枝': '枝', '知': '知', '织': '織',
  '脂': '脂', '蜘': '蜘', '执': '執', '职': '職', '直': '直',
  '值': '值', '植': '植', '殖': '殖', '止': '止', '只': '隻',
  '旨': '旨', '址': '址', '纸': '紙', '指': '指', '志': '志',
  '至': '至', '致': '致', '制': '制', '质': '質', '治': '治',
  '秩': '秩', '智': '智', '滞': '滯', '置': '置', '中': '中',
  '忠': '忠', '终': '終', '钟': '鐘', '衷': '衷', '肿': '腫',
  '种': '種', '众': '眾', '重': '重', '周': '周', '州': '州',
  '洲': '洲', '舟': '舟', '粥': '粥', '轴': '軸', '皱': '皺',
  '骤': '驟', '昼': '晝', '珠': '珠', '株': '株', '诸': '諸',
  '猪': '豬', '蛛': '蛛', '竹': '竹', '烛': '燭', '逐': '逐',
  '主': '主', '煮': '煮', '嘱': '囑', '柱': '柱', '助': '助',
  '住': '住', '注': '注', '驻': '駐', '著': '著', '筑': '築',
  '铸': '鑄', '抓': '抓', '爪': '爪', '拽': '拽', '专': '專',
  '砖': '磚', '转': '轉', '撰': '撰', '赚': '賺', '庄': '莊',
  '装': '裝', '妆': '妝', '桩': '樁', '壮': '壯', '状': '狀',
  '幢': '幢', '撞': '撞', '追': '追', '坠': '墜', '缀': '綴',
  '准': '準', '拙': '拙', '捉': '捉', '桌': '桌', '卓': '卓',
  '浊': '濁', '灼': '灼', '茁': '茁', '酌': '酌', '着': '著',
  '啄': '啄', '琢': '琢', '资': '資', '姿': '姿', '滋': '滋',
  '子': '子', '紫': '紫', '字': '字', '自': '自', '宗': '宗',
  '综': '綜', '棕': '棕', '踪': '蹤', '总': '總', '纵': '縱',
  '走': '走', '奏': '奏', '租': '租', '足': '足', '族': '族',
  '阻': '阻', '组': '組', '祖': '祖', '诅': '詛', '钻': '鑽',
  '嘴': '嘴', '醉': '醉', '最': '最', '罪': '罪', '尊': '尊',
  '遵': '遵', '昨': '昨', '左': '左', '佐': '佐', '作': '作',
  '坐': '坐', '座': '座', '做': '做',
};

// Convert Simplified Chinese to Traditional Chinese
function toTraditionalChinese(text: string): string {
  let result = text;
  for (const [simplified, traditional] of Object.entries(simplifiedToTraditional)) {
    result = result.split(simplified).join(traditional);
  }
  return result;
}

// Initialize Supabase client with service role (for database operations)
function getSupabaseClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );
}

// Check if user has remaining usage quota (DEPRECATED - use checkComprehensiveUsage)
async function checkUsageLimit(supabase: ReturnType<typeof createClient>, userId: string): Promise<UsageCheck> {
  const { data, error } = await supabase.rpc("check_usage_limit", { p_user_id: userId });

  if (error) {
    console.error("Error checking usage limit:", error);
    throw new Error("Failed to check usage limit");
  }

  return data[0];
}

// Check comprehensive usage including AI processing and storage limits
async function checkComprehensiveUsage(supabase: ReturnType<typeof createClient>, userId: string): Promise<ComprehensiveUsage> {
  const { data, error } = await supabase.rpc("check_usage", { p_user_id: userId });

  if (error) {
    console.error("Error checking comprehensive usage:", error);
    throw new Error("Failed to check usage");
  }

  return data as ComprehensiveUsage;
}

// Update user's usage after recording (DEPRECATED - use updateAIUsage)
async function updateUsage(supabase: ReturnType<typeof createClient>, userId: string, minutes: number): Promise<void> {
  const { error } = await supabase.rpc("update_usage", {
    p_user_id: userId,
    p_minutes: minutes,
  });

  if (error) {
    console.error("Error updating usage:", error);
    throw new Error("Failed to update usage");
  }
}

// Update AI processing usage (minutes_transcribed) after transcription
async function updateAIUsage(supabase: ReturnType<typeof createClient>, userId: string, minutes: number): Promise<void> {
  const { error } = await supabase.rpc("increment_ai_usage", {
    p_user_id: userId,
    p_minutes: minutes,
  });

  if (error) {
    console.error("Error updating AI usage:", error);
    throw new Error("Failed to update AI usage");
  }
}

// Update recording status in database
async function updateRecordingStatus(
  supabase: ReturnType<typeof createClient>,
  recordingId: string,
  status: string,
  updates: Record<string, unknown> = {}
): Promise<void> {
  const { error } = await supabase
    .from("recordings")
    .update({ status, ...updates })
    .eq("id", recordingId);

  if (error) {
    console.error("Error updating recording:", error);
    throw new Error("Failed to update recording status");
  }
}

// Transcribe a single audio chunk using Groq Whisper
async function transcribeChunk(audioUrl: string, language: string): Promise<TranscriptionResult> {
  const groqApiKey = Deno.env.get("GROQ_API_KEY");
  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY not configured");
  }

  // Fetch audio file
  console.log(`Fetching audio from: ${audioUrl.substring(0, 80)}...`);
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    const errorBody = await audioResponse.text().catch(() => "");
    console.error(`Audio fetch failed: status=${audioResponse.status}, body=${errorBody.substring(0, 200)}`);
    throw new Error(`Failed to fetch audio: ${audioResponse.status} - ${errorBody.substring(0, 100)}`);
  }

  const audioBlob = await audioResponse.blob();
  console.log(`Audio fetched successfully: ${(audioBlob.size / 1024 / 1024).toFixed(2)}MB, type: ${audioBlob.type}`);

  // Normalize MIME type for Groq API (convert non-standard types like audio/x-m4a to audio/mp4)
  // Groq rejects non-standard MIME types, so we need to convert them
  let normalizedBlob = audioBlob;
  const blobType = audioBlob.type?.toLowerCase() || '';
  if (blobType.includes('x-m4a') || blobType.includes('x-mp4') || blobType.includes('x-aac')) {
    console.log(`Normalizing MIME type from ${audioBlob.type} to audio/mp4`);
    const arrayBuffer = await audioBlob.arrayBuffer();
    normalizedBlob = new Blob([arrayBuffer], { type: 'audio/mp4' });
  }

  // Determine file extension from URL or blob type
  // iOS uses .m4a, web uses .webm
  let fileExtension = "webm";
  if (audioUrl.includes(".m4a") || audioBlob.type?.includes("m4a") || audioBlob.type?.includes("mp4")) {
    fileExtension = "m4a";
  } else if (audioUrl.includes(".wav") || audioBlob.type?.includes("wav")) {
    fileExtension = "wav";
  }
  console.log(`Using file extension: ${fileExtension}`);

  // Prepare form data for Groq
  const formData = new FormData();
  formData.append("file", normalizedBlob, `recording.${fileExtension}`);
  formData.append("model", "whisper-large-v3-turbo");
  formData.append("language", language === "zh-TW" ? "zh" : language);
  formData.append("response_format", "verbose_json");

  // Call Groq Whisper API
  const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Groq transcription error:", errorText);
    throw new Error(`Transcription failed: ${response.status}`);
  }

  const result = await response.json();

  return {
    text: result.text,
    segments: result.segments?.map((seg: { start: number; end: number; text: string }) => ({
      start: seg.start,
      end: seg.end,
      text: seg.text,
    })),
  };
}

// Transcribe all audio chunks and combine results
async function transcribeAllChunks(
  chunks: AudioChunk[],
  language: string
): Promise<{ fullText: string; notes: NoteItem[] }> {
  let fullText = "";
  const allNotes: NoteItem[] = [];
  let noteId = 1;
  const isTraditionalChinese = language === "zh-TW";

  // Sort chunks by index to ensure correct order
  const sortedChunks = [...chunks].sort((a, b) => a.index - b.index);

  for (const chunk of sortedChunks) {
    console.log(`Processing chunk ${chunk.index + 1}/${sortedChunks.length}...`);

    const transcription = await transcribeChunk(chunk.url, language);

    // Convert to Traditional Chinese if needed (Whisper often outputs Simplified)
    let chunkText = transcription.text;
    if (isTraditionalChinese) {
      chunkText = toTraditionalChinese(chunkText);
    }

    // Add space between chunk texts
    if (fullText && chunkText) {
      fullText += " ";
    }
    fullText += chunkText;

    // Convert segments to notes, adjusting timestamps for chunk offset
    if (transcription.segments) {
      for (const segment of transcription.segments) {
        let segmentText = segment.text.trim();
        if (isTraditionalChinese) {
          segmentText = toTraditionalChinese(segmentText);
        }
        allNotes.push({
          id: String(noteId++),
          timestamp: segment.start + chunk.startTime, // Adjust for chunk position
          text: segmentText,
        });
      }
    } else {
      // No segments, create single note for this chunk
      allNotes.push({
        id: String(noteId++),
        timestamp: chunk.startTime,
        text: chunkText,
      });
    }
  }

  return { fullText, notes: allNotes };
}

// Summarize text using Groq Llama
async function summarizeText(text: string, language: string): Promise<string[]> {
  const groqApiKey = Deno.env.get("GROQ_API_KEY");
  if (!groqApiKey) {
    throw new Error("GROQ_API_KEY not configured");
  }

  const systemPrompt =
    language === "zh-TW"
      ? `你是一個專業的會議記錄助手。請將以下錄音逐字稿整理成重點摘要。

重要要求：
- 必須使用台灣繁體中文（Traditional Chinese），絕對不可以使用简体中文（Simplified Chinese）
- 例如：使用「這」而非「这」，使用「說」而非「说」，使用「會」而非「会」
- 提取3-7個最重要的重點
- 每個重點用一句話概括
- 保持客觀，不添加原文沒有的資訊
- 返回JSON格式：{"summary": ["重點1", "重點2", ...]}`
      : `You are a professional meeting notes assistant. Please summarize the following transcript into key points.
Requirements:
- Extract 3-7 most important points
- Summarize each point in one sentence
- Stay objective, don't add information not in the original
- Return JSON format: {"summary": ["point1", "point2", ...]}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text },
      ],
      temperature: 0.3,
      max_tokens: 2048, // Increased for longer recordings
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Groq summarization error:", errorText);
    throw new Error(`Summarization failed: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices[0]?.message?.content;

  try {
    const parsed = JSON.parse(content);
    let summaryPoints = parsed.summary || [];

    // Convert to Traditional Chinese if needed (safety net in case LLM outputs Simplified)
    if (language === "zh-TW") {
      summaryPoints = summaryPoints.map((point: string) => toTraditionalChinese(point));
    }

    return summaryPoints;
  } catch {
    // If JSON parsing fails, try to extract summary from text
    let result = content;
    if (language === "zh-TW") {
      result = toTraditionalChinese(result);
    }
    return [result];
  }
}

// Main handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let recordingId = "unknown";
  let currentStep = "init";

  try {
    currentStep = "create_client";
    const supabase = getSupabaseClient();

    // Parse request
    currentStep = "parse_request";
    const body: ProcessRequest = await req.json();
    const { recording_id, user_id, audio_chunks, language, duration_seconds } = body;
    recordingId = recording_id || "unknown";

    // Validate required fields
    currentStep = "validate_fields";
    if (!recording_id || !user_id || !audio_chunks || audio_chunks.length === 0) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const durationMinutes = duration_seconds / 60;
    const chunkCount = audio_chunks.length;

    console.log(`[${recording_id}] Processing: ${chunkCount} chunk(s), ${durationMinutes.toFixed(1)} minutes`);
    console.log(`[${recording_id}] Audio URL: ${audio_chunks[0]?.url?.substring(0, 80)}...`);

    // Check comprehensive usage limits (AI processing + storage)
    currentStep = "check_usage";
    console.log(`[${recording_id}] Checking usage for user ${user_id}...`);
    const usage = await checkComprehensiveUsage(supabase, user_id);
    console.log(`[${recording_id}] Usage check passed: tier=${usage.tier}, can_process=${usage.can_process}`);

    if (!usage.can_process) {
      // User has exceeded their AI processing limit
      await updateRecordingStatus(supabase, recording_id, "error", {
        error_message: "AI processing limit exceeded",
      });

      return new Response(
        JSON.stringify({
          error: "ai_limit_exceeded",
          message: "You have reached your AI processing limit for this period",
          usage: {
            ai_minutes_used: usage.ai_minutes_used,
            ai_minutes_limit: usage.ai_minutes_limit,
            ai_minutes_remaining: usage.ai_minutes_remaining,
            tier: usage.tier,
          },
        }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to processing
    currentStep = "update_status_processing";
    console.log(`[${recording_id}] Updating status to processing_notes...`);
    await updateRecordingStatus(supabase, recording_id, "processing_notes");

    // Step 1: Transcribe all chunks and combine
    currentStep = "transcribe";
    console.log(`[${recording_id}] Starting transcription of ${chunkCount} chunk(s)...`);
    const { fullText, notes } = await transcribeAllChunks(audio_chunks, language);

    console.log(`[${recording_id}] Transcription complete: ${fullText.length} chars, ${notes.length} segments`);

    // Update with notes
    currentStep = "update_status_notes";
    await updateRecordingStatus(supabase, recording_id, "processing_summary", { notes });

    // Step 2: Summarize if there's enough text
    currentStep = "summarize";
    let summary: string[] = [];
    if (fullText.length > 50) {
      console.log(`[${recording_id}] Summarizing...`);
      summary = await summarizeText(fullText, language);
      console.log(`[${recording_id}] Summarization complete: ${summary.length} points`);
    }

    // Update with final results
    currentStep = "update_status_ready";
    await updateRecordingStatus(supabase, recording_id, "ready", { summary });

    // Update AI usage (transcription counts against limit, summary is free)
    currentStep = "update_ai_usage";
    console.log(`[${recording_id}] Updating AI usage: ${durationMinutes.toFixed(2)} minutes`);
    await updateAIUsage(supabase, user_id, durationMinutes);

    console.log(`[${recording_id}] Processing completed successfully`);

    // Get updated usage after incrementing
    currentStep = "get_final_usage";
    const updatedUsage = await checkComprehensiveUsage(supabase, user_id);

    return new Response(
      JSON.stringify({
        success: true,
        recording_id,
        chunk_count: chunkCount,
        notes_count: notes.length,
        summary_points: summary.length,
        usage: {
          tier: updatedUsage.tier,
          ai_minutes_used: updatedUsage.ai_minutes_used,
          ai_minutes_limit: updatedUsage.ai_minutes_limit,
          ai_minutes_remaining: updatedUsage.ai_minutes_remaining,
          can_process: updatedUsage.can_process,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error(`[${recordingId}] ERROR at step "${currentStep}":`, errorMessage);
    if (errorStack) {
      console.error(`[${recordingId}] Stack trace:`, errorStack);
    }

    return new Response(
      JSON.stringify({
        error: "processing_failed",
        message: errorMessage,
        step: currentStep,
        recording_id: recordingId,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
