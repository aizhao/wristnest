const HOUR = 3600000;
const clamp = value => Math.max(0, Math.min(100, value));
const safe = (value, fallback) => typeof value === 'number' && isFinite(value) ? value : fallback;
function dayKey(now) { return new Date(now + 8 * HOUR).toISOString().slice(0, 10); }
function createPet(now) {
  return {version: 1, food: 65, mood: 72, affinity: 0, updatedAt: now, day: dayKey(now), dailyPoints: 0, actions: {}};
}
function normalize(value, now) {
  const state = createPet(now);
  if (!value || value.version !== 1) return state;
  ['food', 'mood', 'affinity'].forEach(key => { state[key] = clamp(safe(value[key], state[key])); });
  state.updatedAt = Math.max(0, Math.min(now, safe(value.updatedAt, now)));
  state.day = typeof value.day === 'string' ? value.day : state.day;
  state.dailyPoints = Math.max(0, Math.min(12, safe(value.dailyPoints, 0)));
  ['pet', 'feed', 'play'].forEach(key => {
    if (value.actions) state.actions[key] = Math.max(0, Math.min(now, safe(value.actions[key], 0)));
  });
  return state;
}
function advance(value, now) {
  const state = normalize(value, now);
  const hours = Math.max(0, (now - state.updatedAt) / HOUR);
  state.food = clamp(state.food - hours * 2);
  state.mood = clamp(state.mood - hours * 0.5);
  state.updatedAt = now;
  if (state.day !== dayKey(now)) { state.day = dayKey(now); state.dailyPoints = 0; }
  return state;
}
function interact(value, action, now) {
  if (['pet', 'feed', 'play'].indexOf(action) < 0) throw new Error('Unknown interaction');
  const state = advance(value, now);
  const cooldown = {pet: 30000, feed: 300000, play: 60000}[action];
  const previous = state.actions[action];
  if (previous && now - previous < cooldown) {
    return {state, line: action === 'feed' ? '刚吃过啦，陪我待一会儿吧。' : '{nickname}，我还在回味刚刚的开心呢。', animation: 'waiting', rewarded: false};
  }
  if (action === 'feed' && state.food >= 90) return {state, line: '已经吃饱啦，先不吃了。', animation: 'waiting', rewarded: false};
  state.actions[action] = now;
  state.food = clamp(state.food + (action === 'feed' ? 18 : action === 'play' ? -5 : 0));
  state.mood = clamp(state.mood + (action === 'play' ? 10 : 5));
  if (state.dailyPoints < 12) { state.affinity = clamp(state.affinity + 1); state.dailyPoints += 1; }
  const lines = {pet: '嘿嘿，好喜欢{nickname}摸摸我。', feed: '好吃！最喜欢和{nickname}一起吃啦。', play: '好耶！和{nickname}一起玩最开心！'};
  return {state, line: lines[action], animation: action === 'play' ? 'jumping' : action === 'feed' ? 'review' : 'waving', rewarded: true};
}
function moodLine(state) {
  if (state.food < 25) return '有一点饿，想吃点东西';
  return state.mood >= 80 ? '和{nickname}一起就很开心' : state.mood >= 45 ? '想和{nickname}待在一起' : '今天想要多一点陪伴';
}
function appendTurn(history, userText, assistantText) {
  const previous = Array.isArray(history) ? history.filter(item => item && ['user', 'assistant'].indexOf(item.role) >= 0 && typeof item.content === 'string').slice(-10) : [];
  return previous.concat([{role: 'user', content: userText.slice(0, 160)}, {role: 'assistant', content: assistantText.slice(0, 240)}]).slice(-12);
}
module.exports = {createPet, normalize, advance, interact, moodLine, appendTurn};
