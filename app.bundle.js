// node_modules/ts-fsrs/dist/index.mjs
var FSRSError = class _FSRSError extends Error {
  constructor(message = "FSRS Error") {
    super(message);
    this.name = "FSRSError";
    Error.captureStackTrace?.(this, _FSRSError);
  }
};
var FSRSValidationError = class _FSRSValidationError extends FSRSError {
  constructor(message) {
    super(message);
    this.name = "FSRSValidationError";
    Error.captureStackTrace?.(this, _FSRSValidationError);
  }
};
var State = /* @__PURE__ */ ((State2) => {
  State2[State2["New"] = 0] = "New";
  State2[State2["Learning"] = 1] = "Learning";
  State2[State2["Review"] = 2] = "Review";
  State2[State2["Relearning"] = 3] = "Relearning";
  return State2;
})(State || {});
var Rating = /* @__PURE__ */ ((Rating2) => {
  Rating2[Rating2["Manual"] = 0] = "Manual";
  Rating2[Rating2["Again"] = 1] = "Again";
  Rating2[Rating2["Hard"] = 2] = "Hard";
  Rating2[Rating2["Good"] = 3] = "Good";
  Rating2[Rating2["Easy"] = 4] = "Easy";
  return Rating2;
})(Rating || {});
var TypeConvert = class _TypeConvert {
  static card(card) {
    return {
      ...card,
      state: _TypeConvert.state(card.state),
      due: _TypeConvert.time(card.due),
      last_review: card.last_review ? _TypeConvert.time(card.last_review) : void 0
    };
  }
  static rating(value) {
    if (typeof value === "string") {
      const firstLetter = value.charAt(0).toUpperCase();
      const restOfString = value.slice(1).toLowerCase();
      const ret = Rating[`${firstLetter}${restOfString}`];
      if (ret === void 0) {
        throw new FSRSValidationError(`Invalid rating:[${value}]`);
      }
      return ret;
    } else if (typeof value === "number") {
      return value;
    }
    throw new FSRSValidationError(`Invalid rating:[${value}]`);
  }
  static state(value) {
    if (typeof value === "string") {
      const firstLetter = value.charAt(0).toUpperCase();
      const restOfString = value.slice(1).toLowerCase();
      const ret = State[`${firstLetter}${restOfString}`];
      if (ret === void 0) {
        throw new FSRSValidationError(`Invalid state:[${value}]`);
      }
      return ret;
    } else if (typeof value === "number") {
      return value;
    }
    throw new FSRSValidationError(`Invalid state:[${value}]`);
  }
  static time(value) {
    if (value instanceof Date) {
      return value;
    }
    const date = new Date(value);
    if (typeof value === "object" && value !== null && !Number.isNaN(Date.parse(value) || +date)) {
      return date;
    } else if (typeof value === "string") {
      const timestamp = Date.parse(value);
      if (!Number.isNaN(timestamp)) {
        return new Date(timestamp);
      } else {
        throw new FSRSValidationError(`Invalid date:[${value}]`);
      }
    } else if (typeof value === "number") {
      return new Date(value);
    }
    throw new FSRSValidationError(`Invalid date:[${value}]`);
  }
  static review_log(log) {
    return {
      ...log,
      due: _TypeConvert.time(log.due),
      rating: _TypeConvert.rating(log.rating),
      state: _TypeConvert.state(log.state),
      review: _TypeConvert.time(log.review)
    };
  }
};
Date.prototype.scheduler = function(t, isDay) {
  return date_scheduler(this, t, isDay);
};
Date.prototype.diff = function(pre, unit) {
  return date_diff(this, pre, unit);
};
Date.prototype.format = function() {
  return formatDate(this);
};
Date.prototype.dueFormat = function(last_review, unit, timeUnit) {
  return show_diff_message(this, last_review, unit, timeUnit);
};
function date_scheduler(now, t, isDay) {
  return new Date(
    isDay ? TypeConvert.time(now).getTime() + t * 24 * 60 * 60 * 1e3 : TypeConvert.time(now).getTime() + t * 60 * 1e3
  );
}
function date_diff(now, pre, unit) {
  if (!now || !pre) {
    throw new FSRSValidationError("Invalid date");
  }
  const diff = TypeConvert.time(now).getTime() - TypeConvert.time(pre).getTime();
  let r = 0;
  switch (unit) {
    case "days":
      r = Math.floor(diff / (24 * 60 * 60 * 1e3));
      break;
    case "minutes":
      r = Math.floor(diff / (60 * 1e3));
      break;
  }
  return r;
}
function formatDate(dateInput) {
  const date = TypeConvert.time(dateInput);
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  return `${year}-${padZero(month)}-${padZero(day)} ${padZero(hours)}:${padZero(
    minutes
  )}:${padZero(seconds)}`;
}
function padZero(num) {
  return num < 10 ? `0${num}` : `${num}`;
}
var TIMEUNIT = [60, 60, 24, 31, 12];
var TIMEUNITFORMAT = ["second", "min", "hour", "day", "month", "year"];
function show_diff_message(due, last_review, unit, timeUnit = TIMEUNITFORMAT) {
  due = TypeConvert.time(due);
  last_review = TypeConvert.time(last_review);
  if (timeUnit.length !== TIMEUNITFORMAT.length) {
    timeUnit = TIMEUNITFORMAT;
  }
  let diff = due.getTime() - last_review.getTime();
  let i = 0;
  diff /= 1e3;
  for (i = 0; i < TIMEUNIT.length; i++) {
    if (diff < TIMEUNIT[i]) {
      break;
    } else {
      diff /= TIMEUNIT[i];
    }
  }
  return `${Math.floor(diff)}${unit ? timeUnit[i] : ""}`;
}
var Grades = Object.freeze([
  Rating.Again,
  Rating.Hard,
  Rating.Good,
  Rating.Easy
]);
var FUZZ_RANGES = [
  {
    start: 2.5,
    end: 7,
    factor: 0.15
  },
  {
    start: 7,
    end: 20,
    factor: 0.1
  },
  {
    start: 20,
    end: Infinity,
    factor: 0.05
  }
];
function get_fuzz_range(interval, elapsed_days, maximum_interval) {
  let delta = 1;
  for (const range of FUZZ_RANGES) {
    delta += range.factor * Math.max(Math.min(interval, range.end) - range.start, 0);
  }
  interval = Math.min(interval, maximum_interval);
  let min_ivl = Math.max(2, Math.round(interval - delta));
  const max_ivl = Math.min(Math.round(interval + delta), maximum_interval);
  if (interval > elapsed_days) {
    min_ivl = Math.max(min_ivl, elapsed_days + 1);
  }
  min_ivl = Math.min(min_ivl, max_ivl);
  return { min_ivl, max_ivl };
}
function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
function roundTo(num, decimals) {
  const factor = 10 ** decimals;
  return Math.round(num * factor) / factor;
}
function dateDiffInDays(last, cur) {
  const utc1 = Date.UTC(
    last.getUTCFullYear(),
    last.getUTCMonth(),
    last.getUTCDate()
  );
  const utc2 = Date.UTC(
    cur.getUTCFullYear(),
    cur.getUTCMonth(),
    cur.getUTCDate()
  );
  return Math.floor(
    (utc2 - utc1) / 864e5
    /** 1000 * 60 * 60 * 24*/
  );
}
var ConvertStepUnitToMinutes = (step) => {
  const unit = step.slice(-1);
  const value = parseInt(step.slice(0, -1), 10);
  if (Number.isNaN(value) || !Number.isFinite(value) || value < 0) {
    throw new FSRSValidationError(`Invalid step value: ${step}`);
  }
  switch (unit) {
    case "m":
      return value;
    case "h":
      return value * 60;
    case "d":
      return value * 1440;
    default:
      throw new FSRSValidationError(
        `Invalid step unit: ${step}, expected m/h/d`
      );
  }
};
var BasicLearningStepsStrategy = (params, state2, cur_step) => {
  const learning_steps = state2 === State.Relearning || state2 === State.Review ? params.relearning_steps : params.learning_steps;
  const steps_length = learning_steps.length;
  if (steps_length === 0 || cur_step >= steps_length) return {};
  const firstStep = learning_steps[0];
  const toMinutes = ConvertStepUnitToMinutes;
  const getAgainInterval = () => {
    return toMinutes(firstStep);
  };
  const getHardInterval = () => {
    if (steps_length === 1) return Math.round(toMinutes(firstStep) * 1.5);
    const nextStep = learning_steps[1];
    return Math.round((toMinutes(firstStep) + toMinutes(nextStep)) / 2);
  };
  const getStepInfo = (index) => {
    if (index < 0 || index >= steps_length) {
      return null;
    } else {
      return learning_steps[index];
    }
  };
  const getGoodMinutes = (step) => {
    return toMinutes(step);
  };
  const result = {};
  const step_info = getStepInfo(Math.max(0, cur_step));
  if (state2 === State.Review) {
    result[Rating.Again] = {
      scheduled_minutes: toMinutes(step_info),
      next_step: 0
    };
    return result;
  } else {
    result[Rating.Again] = {
      scheduled_minutes: getAgainInterval(),
      next_step: 0
    };
    result[Rating.Hard] = {
      scheduled_minutes: getHardInterval(),
      next_step: cur_step
    };
    const next_info = getStepInfo(cur_step + 1);
    if (next_info) {
      const nextMin = getGoodMinutes(next_info);
      if (nextMin) {
        result[Rating.Good] = {
          scheduled_minutes: Math.round(nextMin),
          next_step: cur_step + 1
        };
      }
    }
  }
  return result;
};
function DefaultInitSeedStrategy() {
  const time = this.review_time.getTime();
  const reps = this.current.reps;
  const mul = this.current.difficulty * this.current.stability;
  return `${time}_${reps}_${mul}`;
}
var StrategyMode = /* @__PURE__ */ ((StrategyMode2) => {
  StrategyMode2["SCHEDULER"] = "Scheduler";
  StrategyMode2["LEARNING_STEPS"] = "LearningSteps";
  StrategyMode2["SEED"] = "Seed";
  return StrategyMode2;
})(StrategyMode || {});
var AbstractScheduler = class {
  last;
  current;
  review_time;
  next = /* @__PURE__ */ new Map();
  algorithm;
  strategies;
  elapsed_days = 0;
  // init
  constructor(card, now, algorithm, strategies) {
    this.algorithm = algorithm;
    this.last = TypeConvert.card(card);
    this.current = TypeConvert.card(card);
    this.review_time = TypeConvert.time(now);
    this.strategies = strategies;
    this.init();
  }
  checkGrade(grade) {
    if (!Number.isFinite(grade) || grade < 1 || grade > 4) {
      throw new FSRSValidationError(`Invalid grade "${grade}",expected 1-4`);
    }
  }
  init() {
    const { state: state2, last_review } = this.current;
    let interval = 0;
    if (state2 !== State.New && last_review) {
      interval = dateDiffInDays(last_review, this.review_time);
    }
    this.current.last_review = this.review_time;
    this.elapsed_days = interval;
    this.current.elapsed_days = interval;
    this.current.reps += 1;
    let seed_strategy = DefaultInitSeedStrategy;
    if (this.strategies) {
      const custom_strategy = this.strategies.get(StrategyMode.SEED);
      if (custom_strategy) {
        seed_strategy = custom_strategy;
      }
    }
    this.algorithm.seed = seed_strategy.call(this);
  }
  preview() {
    return {
      [Rating.Again]: this.review(Rating.Again),
      [Rating.Hard]: this.review(Rating.Hard),
      [Rating.Good]: this.review(Rating.Good),
      [Rating.Easy]: this.review(Rating.Easy),
      [Symbol.iterator]: this.previewIterator.bind(this)
    };
  }
  *previewIterator() {
    for (const grade of Grades) {
      yield this.review(grade);
    }
  }
  review(grade) {
    const { state: state2 } = this.last;
    let item;
    this.checkGrade(grade);
    switch (state2) {
      case State.New:
        item = this.newState(grade);
        break;
      case State.Learning:
      case State.Relearning:
        item = this.learningState(grade);
        break;
      case State.Review:
        item = this.reviewState(grade);
        break;
    }
    return item;
  }
  buildLog(rating) {
    const { last_review, due, elapsed_days } = this.last;
    return {
      rating,
      state: this.current.state,
      due: last_review || due,
      stability: this.current.stability,
      difficulty: this.current.difficulty,
      elapsed_days: this.elapsed_days,
      last_elapsed_days: elapsed_days,
      scheduled_days: this.current.scheduled_days,
      learning_steps: this.current.learning_steps,
      review: this.review_time
    };
  }
};
var Alea = class {
  c;
  s0;
  s1;
  s2;
  constructor(seed) {
    const mash = Mash();
    this.c = 1;
    this.s0 = mash(" ");
    this.s1 = mash(" ");
    this.s2 = mash(" ");
    if (seed == null) seed = Date.now();
    this.s0 -= mash(seed);
    if (this.s0 < 0) this.s0 += 1;
    this.s1 -= mash(seed);
    if (this.s1 < 0) this.s1 += 1;
    this.s2 -= mash(seed);
    if (this.s2 < 0) this.s2 += 1;
  }
  next() {
    const t = 2091639 * this.s0 + this.c * 23283064365386963e-26;
    this.s0 = this.s1;
    this.s1 = this.s2;
    this.c = t | 0;
    this.s2 = t - this.c;
    return this.s2;
  }
  set state(state2) {
    this.c = state2.c;
    this.s0 = state2.s0;
    this.s1 = state2.s1;
    this.s2 = state2.s2;
  }
  get state() {
    return {
      c: this.c,
      s0: this.s0,
      s1: this.s1,
      s2: this.s2
    };
  }
};
function Mash() {
  let n = 4022871197;
  return function mash(data) {
    data = String(data);
    for (let i = 0; i < data.length; i++) {
      n += data.charCodeAt(i);
      let h = 0.02519603282416938 * n;
      n = h >>> 0;
      h -= n;
      h *= n;
      n = h >>> 0;
      h -= n;
      n += h * 4294967296;
    }
    return (n >>> 0) * 23283064365386963e-26;
  };
}
function alea(seed) {
  const xg = new Alea(seed);
  const prng = () => xg.next();
  prng.int32 = () => xg.next() * 4294967296 | 0;
  prng.double = () => prng() + (prng() * 2097152 | 0) * 11102230246251565e-32;
  prng.state = () => xg.state;
  prng.importState = (state2) => {
    xg.state = state2;
    return prng;
  };
  return prng;
}
var version = "5.4.1";
var default_request_retention = 0.9;
var default_maximum_interval = 36500;
var default_enable_fuzz = false;
var default_enable_short_term = true;
var default_learning_steps = Object.freeze([
  "1m",
  "10m"
]);
var default_relearning_steps = Object.freeze([
  "10m"
]);
var FSRSVersion = `v${version} using FSRS-6.0`;
var S_MIN = 1e-3;
var INIT_S_MAX = 100;
var FSRS5_DEFAULT_DECAY = 0.5;
var FSRS6_DEFAULT_DECAY = 0.1542;
var default_w = Object.freeze([
  0.212,
  1.2931,
  2.3065,
  8.2956,
  6.4133,
  0.8334,
  3.0194,
  1e-3,
  1.8722,
  0.1666,
  0.796,
  1.4835,
  0.0614,
  0.2629,
  1.6483,
  0.6014,
  1.8729,
  0.5425,
  0.0912,
  0.0658,
  FSRS6_DEFAULT_DECAY
]);
var W17_W18_Ceiling = 2;
var CLAMP_PARAMETERS = (w17_w18_ceiling, enable_short_term = default_enable_short_term) => [
  [S_MIN, INIT_S_MAX],
  [S_MIN, INIT_S_MAX],
  [S_MIN, INIT_S_MAX],
  [S_MIN, INIT_S_MAX],
  [1, 10],
  [1e-3, 4],
  [1e-3, 4],
  [1e-3, 0.75],
  [0, 4.5],
  [0, 0.8],
  [1e-3, 3.5],
  [1e-3, 5],
  [1e-3, 0.25],
  [1e-3, 0.9],
  [0, 4],
  [0, 1],
  [1, 6],
  [0, w17_w18_ceiling],
  [0, w17_w18_ceiling],
  [
    enable_short_term ? 0.01 : 0,
    0.8
  ],
  [0.1, 0.8]
];
var clipParameters = (parameters, numRelearningSteps, enableShortTerm = default_enable_short_term) => {
  const clip = CLAMP_PARAMETERS(W17_W18_Ceiling, enableShortTerm).slice(
    0,
    parameters.length
  );
  if (Math.max(0, numRelearningSteps) > 1) {
    const w11 = clamp(parameters[11] || 0, clip[11][0], clip[11][1]);
    const w13 = clamp(parameters[13] || 0, clip[13][0], clip[13][1]);
    const w14 = clamp(parameters[14] || 0, clip[14][0], clip[14][1]);
    const value = -(Math.log(w11) + Math.log(Math.pow(2, w13) - 1) + w14 * 0.3) / numRelearningSteps;
    const w17_w18_ceiling = clamp(
      roundTo(Math.sqrt(Math.max(value, 0)), 8),
      0.01,
      W17_W18_Ceiling
    );
    if (clip[17]) clip[17] = [clip[17][0], w17_w18_ceiling];
    if (clip[18]) clip[18] = [clip[18][0], w17_w18_ceiling];
  }
  return clip.map(
    ([min, max], index) => clamp(parameters[index] || 0, min, max)
  );
};
var migrateParameters = (parameters, numRelearningSteps = 0, enableShortTerm = default_enable_short_term) => {
  if (parameters === void 0) {
    return [...default_w];
  }
  switch (parameters.length) {
    case 21:
      return clipParameters(
        Array.from(parameters),
        numRelearningSteps,
        enableShortTerm
      );
    case 19:
      console.debug("[FSRS-6]auto fill w from 19 to 21 length");
      return clipParameters(
        Array.from(parameters),
        numRelearningSteps,
        enableShortTerm
      ).concat([0, FSRS5_DEFAULT_DECAY]);
    case 17: {
      const w = clipParameters(
        Array.from(parameters),
        numRelearningSteps,
        enableShortTerm
      );
      w[4] = +(w[5] * 2 + w[4]).toFixed(8);
      w[5] = +(Math.log(w[5] * 3 + 1) / 3).toFixed(8);
      w[6] = +(w[6] + 0.5).toFixed(8);
      console.debug("[FSRS-6]auto fill w from 17 to 21 length");
      return w.concat([0, 0, 0, FSRS5_DEFAULT_DECAY]);
    }
    default:
      console.warn("[FSRS]Invalid parameters length, using default parameters");
      return [...default_w];
  }
};
var generatorParameters = (props) => {
  const learning_steps = Array.isArray(props?.learning_steps) ? props.learning_steps : default_learning_steps;
  const relearning_steps = Array.isArray(props?.relearning_steps) ? props.relearning_steps : default_relearning_steps;
  const enable_short_term = props?.enable_short_term ?? default_enable_short_term;
  const w = migrateParameters(
    props?.w,
    relearning_steps.length,
    enable_short_term
  );
  return {
    request_retention: props?.request_retention || default_request_retention,
    maximum_interval: props?.maximum_interval || default_maximum_interval,
    w,
    enable_fuzz: props?.enable_fuzz ?? default_enable_fuzz,
    enable_short_term,
    learning_steps,
    relearning_steps
  };
};
function createEmptyCard(now, afterHandler) {
  const emptyCard2 = {
    due: now ? TypeConvert.time(now) : /* @__PURE__ */ new Date(),
    stability: 0,
    difficulty: 0,
    elapsed_days: 0,
    scheduled_days: 0,
    reps: 0,
    lapses: 0,
    learning_steps: 0,
    state: State.New,
    last_review: void 0
  };
  if (afterHandler && typeof afterHandler === "function") {
    return afterHandler(emptyCard2);
  } else {
    return emptyCard2;
  }
}
var computeDecayFactor = (decayOrParams) => {
  const decay = typeof decayOrParams === "number" ? -decayOrParams : -decayOrParams[20];
  const factor = Math.exp(Math.pow(decay, -1) * Math.log(0.9)) - 1;
  return { decay, factor: roundTo(factor, 8) };
};
function forgetting_curve(decayOrParams, elapsed_days, stability) {
  const { decay, factor } = computeDecayFactor(decayOrParams);
  return roundTo(Math.pow(1 + factor * elapsed_days / stability, decay), 8);
}
var FSRSAlgorithm = class {
  param;
  intervalModifier;
  _seed;
  constructor(params) {
    this.param = new Proxy(
      generatorParameters(params),
      this.params_handler_proxy()
    );
    this.intervalModifier = this.calculate_interval_modifier(
      this.param.request_retention
    );
    this.forgetting_curve = forgetting_curve.bind(this, this.param.w);
  }
  get interval_modifier() {
    return this.intervalModifier;
  }
  set seed(seed) {
    this._seed = seed;
  }
  /**
   * @see https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm#fsrs-5
   *
   * The formula used is: $$I(r,s) = (r^{\frac{1}{DECAY}} - 1) / FACTOR \times s$$
   * @param request_retention 0<request_retention<=1,Requested retention rate
   * @throws {Error} Requested retention rate should be in the range (0,1]
   */
  calculate_interval_modifier(request_retention) {
    if (request_retention <= 0 || request_retention > 1) {
      throw new FSRSValidationError(
        "Requested retention rate should be in the range (0,1]"
      );
    }
    const { decay, factor } = computeDecayFactor(this.param.w);
    return roundTo((Math.pow(request_retention, 1 / decay) - 1) / factor, 8);
  }
  /**
   * Get the parameters of the algorithm.
   */
  get parameters() {
    return this.param;
  }
  /**
   * Set the parameters of the algorithm.
   * @param params Partial<FSRSParameters>
   */
  set parameters(params) {
    this.update_parameters(params);
  }
  params_handler_proxy() {
    const _this = this;
    return {
      set: function(target, prop, value) {
        if (prop === "request_retention" && Number.isFinite(value)) {
          _this.intervalModifier = _this.calculate_interval_modifier(
            Number(value)
          );
        } else if (prop === "w") {
          value = migrateParameters(
            value,
            target.relearning_steps.length,
            target.enable_short_term
          );
          _this.forgetting_curve = forgetting_curve.bind(this, value);
          _this.intervalModifier = _this.calculate_interval_modifier(
            Number(target.request_retention)
          );
        }
        Reflect.set(target, prop, value);
        return true;
      }
    };
  }
  update_parameters(params) {
    const _params = generatorParameters(params);
    for (const key in _params) {
      const paramKey = key;
      this.param[paramKey] = _params[paramKey];
    }
  }
  /**
     * The formula used is :
     * $$ S_0(G) = w_{G-1}$$
     * $$S_0 = \max \lbrace S_0,0.1\rbrace $$
  
     * @param g Grade (rating at Anki) [1.again,2.hard,3.good,4.easy]
     * @return Stability (interval when R=90%)
     */
  init_stability(g) {
    return Math.max(this.param.w[g - 1], 0.1);
  }
  /**
   * The formula used is :
   * $$D_0(G) = w_4 - e^{(G-1) \cdot w_5} + 1 $$
   * $$D_0 = \min \lbrace \max \lbrace D_0(G),1 \rbrace,10 \rbrace$$
   * where the $$D_0(1)=w_4$$ when the first rating is good.
   *
   * @param {Grade} g Grade (rating at Anki) [1.again,2.hard,3.good,4.easy]
   * @return {number} Difficulty $$D \in [1,10]$$
   */
  init_difficulty(g) {
    const w = this.param.w;
    const d = w[4] - Math.exp((g - 1) * w[5]) + 1;
    return roundTo(d, 8);
  }
  /**
   * If fuzzing is disabled or ivl is less than 2.5, it returns the original interval.
   * @param {number} ivl - The interval to be fuzzed.
   * @param {number} elapsed_days t days since the last review
   * @return {number} - The fuzzed interval.
   **/
  apply_fuzz(ivl, elapsed_days) {
    if (!this.param.enable_fuzz || ivl < 2.5) return Math.round(ivl);
    const generator = alea(this._seed);
    const fuzz_factor = generator();
    const { min_ivl, max_ivl } = get_fuzz_range(
      ivl,
      elapsed_days,
      this.param.maximum_interval
    );
    return Math.floor(fuzz_factor * (max_ivl - min_ivl + 1) + min_ivl);
  }
  /**
   *   @see The formula used is : {@link FSRSAlgorithm.calculate_interval_modifier}
   *   @param {number} s - Stability (interval when R=90%)
   *   @param {number} elapsed_days t days since the last review
   */
  next_interval(s, elapsed_days) {
    const newInterval = Math.min(
      Math.max(1, Math.round(s * this.intervalModifier)),
      this.param.maximum_interval
    );
    return this.apply_fuzz(newInterval, elapsed_days);
  }
  /**
   * @see https://github.com/open-spaced-repetition/fsrs4anki/issues/697
   */
  linear_damping(delta_d, old_d) {
    return roundTo(delta_d * (10 - old_d) / 9, 8);
  }
  /**
   * The formula used is :
   * $$\text{delta}_d = -w_6 \cdot (g - 3)$$
   * $$\text{next}_d = D + \text{linear damping}(\text{delta}_d , D)$$
   * $$D^\prime(D,R) = w_7 \cdot D_0(4) +(1 - w_7) \cdot \text{next}_d$$
   * @param {number} d Difficulty $$D \in [1,10]$$
   * @param {Grade} g Grade (rating at Anki) [1.again,2.hard,3.good,4.easy]
   * @return {number} $$\text{next}_D$$
   */
  next_difficulty(d, g) {
    const delta_d = -this.param.w[6] * (g - 3);
    const next_d = d + this.linear_damping(delta_d, d);
    return clamp(
      this.mean_reversion(this.init_difficulty(Rating.Easy), next_d),
      1,
      10
    );
  }
  /**
   * The formula used is :
   * $$w_7 \cdot \text{init} +(1 - w_7) \cdot \text{current}$$
   * @param {number} init $$w_2 : D_0(3) = w_2 + (R-2) \cdot w_3= w_2$$
   * @param {number} current $$D - w_6 \cdot (R - 2)$$
   * @return {number} difficulty
   */
  mean_reversion(init2, current) {
    const w = this.param.w;
    return roundTo(w[7] * init2 + (1 - w[7]) * current, 8);
  }
  /**
   * The formula used is :
   * $$S^\prime_r(D,S,R,G) = S\cdot(e^{w_8}\cdot (11-D)\cdot S^{-w_9}\cdot(e^{w_{10}\cdot(1-R)}-1)\cdot w_{15}(\text{if} G=2) \cdot w_{16}(\text{if} G=4)+1)$$
   * @param {number} d Difficulty D \in [1,10]
   * @param {number} s Stability (interval when R=90%)
   * @param {number} r Retrievability (probability of recall)
   * @param {Grade} g Grade (Rating[0.again,1.hard,2.good,3.easy])
   * @return {number} S^\prime_r new stability after recall
   */
  next_recall_stability(d, s, r, g) {
    const w = this.param.w;
    const hard_penalty = Rating.Hard === g ? w[15] : 1;
    const easy_bound = Rating.Easy === g ? w[16] : 1;
    return roundTo(
      clamp(
        s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp((1 - r) * w[10]) - 1) * hard_penalty * easy_bound),
        S_MIN,
        36500
      ),
      8
    );
  }
  /**
   * The formula used is :
   * $$S^\prime_f(D,S,R) = w_{11}\cdot D^{-w_{12}}\cdot ((S+1)^{w_{13}}-1) \cdot e^{w_{14}\cdot(1-R)}$$
   * enable_short_term = true : $$S^\prime_f \in \min \lbrace \max \lbrace S^\prime_f,0.01\rbrace, \frac{S}{e^{w_{17} \cdot w_{18}}} \rbrace$$
   * enable_short_term = false : $$S^\prime_f \in \min \lbrace \max \lbrace S^\prime_f,0.01\rbrace, S \rbrace$$
   * @param {number} d Difficulty D \in [1,10]
   * @param {number} s Stability (interval when R=90%)
   * @param {number} r Retrievability (probability of recall)
   * @return {number} S^\prime_f new stability after forgetting
   */
  next_forget_stability(d, s, r) {
    const w = this.param.w;
    return roundTo(
      clamp(
        w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp((1 - r) * w[14]),
        S_MIN,
        36500
      ),
      8
    );
  }
  /**
   * The formula used is :
   * $$S^\prime_s(S,G) = S \cdot e^{w_{17} \cdot (G-3+w_{18})}$$
   * @param {number} s Stability (interval when R=90%)
   * @param {Grade} g Grade (Rating[0.again,1.hard,2.good,3.easy])
   */
  next_short_term_stability(s, g) {
    const w = this.param.w;
    const sinc = Math.pow(s, -w[19]) * Math.exp(w[17] * (g - 3 + w[18]));
    const maskedSinc = g >= Rating.Hard ? Math.max(sinc, 1) : sinc;
    return roundTo(clamp(s * maskedSinc, S_MIN, 36500), 8);
  }
  /**
   * The formula used is :
   * $$R(t,S) = (1 + \text{FACTOR} \times \frac{t}{9 \cdot S})^{\text{DECAY}}$$
   * @param {number} elapsed_days t days since the last review
   * @param {number} stability Stability (interval when R=90%)
   * @return {number} r Retrievability (probability of recall)
   */
  forgetting_curve;
  /**
   * Calculates the next state of memory based on the current state, time elapsed, and grade.
   *
   * @param memory_state - The current state of memory, which can be null.
   * @param t - The time elapsed since the last review.
   * @param {Rating} g Grade (Rating[0.Manual,1.Again,2.Hard,3.Good,4.Easy])
   * @param r - Optional retrievability value. If not provided, it will be calculated.
   * @returns The next state of memory with updated difficulty and stability.
   */
  next_state(memory_state, t, g, r) {
    const { difficulty: d, stability: s } = memory_state ?? {
      difficulty: 0,
      stability: 0
    };
    if (t < 0) {
      throw new FSRSValidationError(`Invalid delta_t "${t}"`);
    }
    if (g < 0 || g > 4) {
      throw new FSRSValidationError(`Invalid grade "${g}"`);
    }
    if (d === 0 && s === 0) {
      return {
        difficulty: clamp(this.init_difficulty(g), 1, 10),
        stability: this.init_stability(g)
      };
    }
    if (g === 0) {
      return {
        difficulty: d,
        stability: s
      };
    }
    if (d < 1 || s < S_MIN) {
      throw new FSRSValidationError(
        `Invalid memory state { difficulty: ${d}, stability: ${s} }`
      );
    }
    const w = this.param.w;
    r = typeof r === "number" ? r : this.forgetting_curve(t, s);
    let new_s;
    if (t === 0 && this.param.enable_short_term) {
      new_s = this.next_short_term_stability(s, g);
    } else if (g === 1) {
      const s_after_fail = this.next_forget_stability(d, s, r);
      let [w_17, w_18] = [0, 0];
      if (this.param.enable_short_term) {
        w_17 = w[17];
        w_18 = w[18];
      }
      const next_s_min = s / Math.exp(w_17 * w_18);
      new_s = clamp(roundTo(next_s_min, 8), S_MIN, s_after_fail);
    } else {
      new_s = this.next_recall_stability(d, s, r, g);
    }
    const new_d = this.next_difficulty(d, g);
    return { difficulty: new_d, stability: new_s };
  }
};
var BasicScheduler = class extends AbstractScheduler {
  learningStepsStrategy;
  constructor(card, now, algorithm, strategies) {
    super(card, now, algorithm, strategies);
    let learningStepStrategy = BasicLearningStepsStrategy;
    if (this.strategies) {
      const custom_strategy = this.strategies.get(StrategyMode.LEARNING_STEPS);
      if (custom_strategy) {
        learningStepStrategy = custom_strategy;
      }
    }
    this.learningStepsStrategy = learningStepStrategy;
  }
  getLearningInfo(card, grade) {
    const parameters = this.algorithm.parameters;
    card.learning_steps = card.learning_steps || 0;
    const steps_strategy = this.learningStepsStrategy(
      parameters,
      card.state,
      card.learning_steps
    );
    const scheduled_minutes = Math.max(
      0,
      steps_strategy[grade]?.scheduled_minutes ?? 0
    );
    const next_steps = Math.max(0, steps_strategy[grade]?.next_step ?? 0);
    return {
      scheduled_minutes,
      next_steps
    };
  }
  /**
   * @description This function applies the learning steps based on the current card's state and grade.
   */
  applyLearningSteps(nextCard, grade, to_state) {
    const { scheduled_minutes, next_steps } = this.getLearningInfo(
      this.current,
      grade
    );
    if (scheduled_minutes > 0 && scheduled_minutes < 1440) {
      nextCard.learning_steps = next_steps;
      nextCard.scheduled_days = 0;
      nextCard.state = to_state;
      nextCard.due = date_scheduler(
        this.review_time,
        Math.round(scheduled_minutes),
        false
        /** true:days false: minute */
      );
    } else {
      nextCard.state = State.Review;
      if (scheduled_minutes >= 1440) {
        nextCard.learning_steps = next_steps;
        nextCard.due = date_scheduler(
          this.review_time,
          Math.round(scheduled_minutes),
          false
          /** true:days false: minute */
        );
        nextCard.scheduled_days = Math.floor(scheduled_minutes / 1440);
      } else {
        nextCard.learning_steps = 0;
        const interval = this.algorithm.next_interval(
          nextCard.stability,
          this.elapsed_days
        );
        nextCard.scheduled_days = interval;
        nextCard.due = date_scheduler(this.review_time, interval, true);
      }
    }
  }
  newState(grade) {
    const exist = this.next.get(grade);
    if (exist) {
      return exist;
    }
    const next = this.next_ds(this.elapsed_days, grade);
    this.applyLearningSteps(next, grade, State.Learning);
    const item = {
      card: next,
      log: this.buildLog(grade)
    };
    this.next.set(grade, item);
    return item;
  }
  learningState(grade) {
    const exist = this.next.get(grade);
    if (exist) {
      return exist;
    }
    const next = this.next_ds(this.elapsed_days, grade);
    this.applyLearningSteps(
      next,
      grade,
      this.last.state
      /** Learning or Relearning */
    );
    const item = {
      card: next,
      log: this.buildLog(grade)
    };
    this.next.set(grade, item);
    return item;
  }
  reviewState(grade) {
    const exist = this.next.get(grade);
    if (exist) {
      return exist;
    }
    const interval = this.elapsed_days;
    const retrievability2 = this.algorithm.forgetting_curve(
      interval,
      this.current.stability
    );
    const next_again = this.next_ds(interval, Rating.Again, retrievability2);
    const next_hard = this.next_ds(interval, Rating.Hard, retrievability2);
    const next_good = this.next_ds(interval, Rating.Good, retrievability2);
    const next_easy = this.next_ds(interval, Rating.Easy, retrievability2);
    this.next_interval(next_hard, next_good, next_easy, interval);
    this.next_state(next_hard, next_good, next_easy);
    this.applyLearningSteps(next_again, Rating.Again, State.Relearning);
    next_again.lapses += 1;
    const item_again = {
      card: next_again,
      log: this.buildLog(Rating.Again)
    };
    const item_hard = {
      card: next_hard,
      log: super.buildLog(Rating.Hard)
    };
    const item_good = {
      card: next_good,
      log: super.buildLog(Rating.Good)
    };
    const item_easy = {
      card: next_easy,
      log: super.buildLog(Rating.Easy)
    };
    this.next.set(Rating.Again, item_again);
    this.next.set(Rating.Hard, item_hard);
    this.next.set(Rating.Good, item_good);
    this.next.set(Rating.Easy, item_easy);
    return this.next.get(grade);
  }
  /**
   * Review next_ds
   */
  next_ds(t, g, r) {
    const next_state = this.algorithm.next_state(
      {
        difficulty: this.current.difficulty,
        stability: this.current.stability
      },
      t,
      g,
      r
    );
    const card = TypeConvert.card(this.current);
    card.difficulty = next_state.difficulty;
    card.stability = next_state.stability;
    return card;
  }
  /**
   * Review next_interval
   */
  next_interval(next_hard, next_good, next_easy, interval) {
    let hard_interval, good_interval;
    hard_interval = this.algorithm.next_interval(next_hard.stability, interval);
    good_interval = this.algorithm.next_interval(next_good.stability, interval);
    hard_interval = Math.min(hard_interval, good_interval);
    good_interval = Math.max(good_interval, hard_interval + 1);
    const easy_interval = Math.max(
      this.algorithm.next_interval(next_easy.stability, interval),
      good_interval + 1
    );
    next_hard.scheduled_days = hard_interval;
    next_hard.due = date_scheduler(this.review_time, hard_interval, true);
    next_good.scheduled_days = good_interval;
    next_good.due = date_scheduler(this.review_time, good_interval, true);
    next_easy.scheduled_days = easy_interval;
    next_easy.due = date_scheduler(this.review_time, easy_interval, true);
  }
  /**
   * Review next_state
   */
  next_state(next_hard, next_good, next_easy) {
    next_hard.state = State.Review;
    next_hard.learning_steps = 0;
    next_good.state = State.Review;
    next_good.learning_steps = 0;
    next_easy.state = State.Review;
    next_easy.learning_steps = 0;
  }
};
var LongTermScheduler = class extends AbstractScheduler {
  newState(grade) {
    const exist = this.next.get(grade);
    if (exist) {
      return exist;
    }
    this.current.scheduled_days = 0;
    this.current.elapsed_days = 0;
    const first_interval = 0;
    const next_again = this.next_ds(first_interval, Rating.Again);
    const next_hard = this.next_ds(first_interval, Rating.Hard);
    const next_good = this.next_ds(first_interval, Rating.Good);
    const next_easy = this.next_ds(first_interval, Rating.Easy);
    this.next_interval(
      next_again,
      next_hard,
      next_good,
      next_easy,
      first_interval
    );
    this.next_state(next_again, next_hard, next_good, next_easy);
    this.update_next(next_again, next_hard, next_good, next_easy);
    return this.next.get(grade);
  }
  next_ds(t, g, r) {
    const next_state = this.algorithm.next_state(
      {
        difficulty: this.current.difficulty,
        stability: this.current.stability
      },
      t,
      g,
      r
    );
    const card = TypeConvert.card(this.current);
    card.difficulty = next_state.difficulty;
    card.stability = next_state.stability;
    return card;
  }
  /**
   * @see https://github.com/open-spaced-repetition/ts-fsrs/issues/98#issuecomment-2241923194
   */
  learningState(grade) {
    return this.reviewState(grade);
  }
  reviewState(grade) {
    const exist = this.next.get(grade);
    if (exist) {
      return exist;
    }
    const interval = this.elapsed_days;
    const retrievability2 = this.algorithm.forgetting_curve(
      interval,
      this.current.stability
    );
    const next_again = this.next_ds(interval, Rating.Again, retrievability2);
    const next_hard = this.next_ds(interval, Rating.Hard, retrievability2);
    const next_good = this.next_ds(interval, Rating.Good, retrievability2);
    const next_easy = this.next_ds(interval, Rating.Easy, retrievability2);
    this.next_interval(next_again, next_hard, next_good, next_easy, interval);
    this.next_state(next_again, next_hard, next_good, next_easy);
    next_again.lapses += 1;
    this.update_next(next_again, next_hard, next_good, next_easy);
    return this.next.get(grade);
  }
  /**
   * Review/New next_interval
   */
  next_interval(next_again, next_hard, next_good, next_easy, interval) {
    let again_interval, hard_interval, good_interval, easy_interval;
    again_interval = this.algorithm.next_interval(
      next_again.stability,
      interval
    );
    hard_interval = this.algorithm.next_interval(next_hard.stability, interval);
    good_interval = this.algorithm.next_interval(next_good.stability, interval);
    easy_interval = this.algorithm.next_interval(next_easy.stability, interval);
    again_interval = Math.min(again_interval, hard_interval);
    hard_interval = Math.max(hard_interval, again_interval + 1);
    good_interval = Math.max(good_interval, hard_interval + 1);
    easy_interval = Math.max(easy_interval, good_interval + 1);
    next_again.scheduled_days = again_interval;
    next_again.due = date_scheduler(this.review_time, again_interval, true);
    next_hard.scheduled_days = hard_interval;
    next_hard.due = date_scheduler(this.review_time, hard_interval, true);
    next_good.scheduled_days = good_interval;
    next_good.due = date_scheduler(this.review_time, good_interval, true);
    next_easy.scheduled_days = easy_interval;
    next_easy.due = date_scheduler(this.review_time, easy_interval, true);
  }
  /**
   * Review/New next_state
   */
  next_state(next_again, next_hard, next_good, next_easy) {
    next_again.state = State.Review;
    next_again.learning_steps = 0;
    next_hard.state = State.Review;
    next_hard.learning_steps = 0;
    next_good.state = State.Review;
    next_good.learning_steps = 0;
    next_easy.state = State.Review;
    next_easy.learning_steps = 0;
  }
  update_next(next_again, next_hard, next_good, next_easy) {
    const item_again = {
      card: next_again,
      log: this.buildLog(Rating.Again)
    };
    const item_hard = {
      card: next_hard,
      log: super.buildLog(Rating.Hard)
    };
    const item_good = {
      card: next_good,
      log: super.buildLog(Rating.Good)
    };
    const item_easy = {
      card: next_easy,
      log: super.buildLog(Rating.Easy)
    };
    this.next.set(Rating.Again, item_again);
    this.next.set(Rating.Hard, item_hard);
    this.next.set(Rating.Good, item_good);
    this.next.set(Rating.Easy, item_easy);
  }
};
var Reschedule = class {
  fsrs;
  /**
   * Creates an instance of the `Reschedule` class.
   * @param fsrs - An instance of the FSRS class used for scheduling.
   */
  constructor(fsrs2) {
    this.fsrs = fsrs2;
  }
  /**
   * Replays a review for a card and determines the next review date based on the given rating.
   * @param card - The card being reviewed.
   * @param reviewed - The date the card was reviewed.
   * @param rating - The grade given to the card during the review.
   * @returns A `RecordLogItem` containing the updated card and review log.
   */
  replay(card, reviewed, rating) {
    return this.fsrs.next(card, reviewed, rating);
  }
  /**
   * Processes a manual review for a card, allowing for custom state, stability, difficulty, and due date.
   * @param card - The card being reviewed.
   * @param state - The state of the card after the review.
   * @param reviewed - The date the card was reviewed.
   * @param elapsed_days - The number of days since the last review.
   * @param stability - (Optional) The stability of the card.
   * @param difficulty - (Optional) The difficulty of the card.
   * @param due - (Optional) The due date for the next review.
   * @returns A `RecordLogItem` containing the updated card and review log.
   * @throws Will throw an error if the state or due date is not provided when required.
   */
  handleManualRating(card, state2, reviewed, elapsed_days, stability, difficulty, due) {
    if (typeof state2 === "undefined") {
      throw new FSRSValidationError(
        "reschedule: state is required for manual rating"
      );
    }
    let log;
    let next_card;
    if (state2 === State.New) {
      log = {
        rating: Rating.Manual,
        state: state2,
        due: due ?? reviewed,
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days,
        last_elapsed_days: card.elapsed_days,
        scheduled_days: card.scheduled_days,
        learning_steps: card.learning_steps,
        review: reviewed
      };
      next_card = createEmptyCard(reviewed);
      next_card.last_review = reviewed;
    } else {
      if (typeof due === "undefined") {
        throw new FSRSValidationError(
          "reschedule: due is required for manual rating"
        );
      }
      const scheduled_days = date_diff(due, reviewed, "days");
      log = {
        rating: Rating.Manual,
        state: card.state,
        due: card.last_review || card.due,
        stability: card.stability,
        difficulty: card.difficulty,
        elapsed_days,
        last_elapsed_days: card.elapsed_days,
        scheduled_days: card.scheduled_days,
        learning_steps: card.learning_steps,
        review: reviewed
      };
      next_card = {
        ...card,
        state: state2,
        due,
        last_review: reviewed,
        stability: stability || card.stability,
        difficulty: difficulty || card.difficulty,
        elapsed_days,
        scheduled_days,
        reps: card.reps + 1
      };
    }
    return { card: next_card, log };
  }
  /**
   * Reschedules a card based on its review history.
   *
   * @param current_card - The card to be rescheduled.
   * @param reviews - An array of review history objects.
   * @returns An array of record log items representing the rescheduling process.
   */
  reschedule(current_card, reviews) {
    const collections = [];
    let cur_card = createEmptyCard(current_card.due);
    for (const review of reviews) {
      let item;
      review.review = TypeConvert.time(review.review);
      if (review.rating === Rating.Manual) {
        let interval = 0;
        if (cur_card.state !== State.New && cur_card.last_review) {
          interval = date_diff(review.review, cur_card.last_review, "days");
        }
        item = this.handleManualRating(
          cur_card,
          review.state,
          review.review,
          interval,
          review.stability,
          review.difficulty,
          review.due ? TypeConvert.time(review.due) : void 0
        );
      } else {
        item = this.replay(cur_card, review.review, review.rating);
      }
      collections.push(item);
      cur_card = item.card;
    }
    return collections;
  }
  calculateManualRecord(current_card, now, record_log_item, update_memory) {
    if (!record_log_item) {
      return null;
    }
    const { card: reschedule_card, log } = record_log_item;
    const cur_card = TypeConvert.card(current_card);
    if (cur_card.due.getTime() === reschedule_card.due.getTime()) {
      return null;
    }
    cur_card.scheduled_days = date_diff(
      reschedule_card.due,
      cur_card.due,
      "days"
    );
    return this.handleManualRating(
      cur_card,
      reschedule_card.state,
      TypeConvert.time(now),
      log.elapsed_days,
      update_memory ? reschedule_card.stability : void 0,
      update_memory ? reschedule_card.difficulty : void 0,
      reschedule_card.due
    );
  }
};
function applyAfterHandler(value, afterHandler) {
  return typeof afterHandler === "function" ? afterHandler(value) : value;
}
var FSRS = class extends FSRSAlgorithm {
  strategyHandler = /* @__PURE__ */ new Map();
  Scheduler;
  constructor(param) {
    super(param);
    const { enable_short_term } = this.parameters;
    this.Scheduler = enable_short_term ? BasicScheduler : LongTermScheduler;
  }
  params_handler_proxy() {
    const _this = this;
    return {
      set: function(target, prop, value) {
        if (prop === "request_retention" && Number.isFinite(value)) {
          _this.intervalModifier = _this.calculate_interval_modifier(
            Number(value)
          );
        } else if (prop === "enable_short_term") {
          _this.Scheduler = value === true ? BasicScheduler : LongTermScheduler;
        } else if (prop === "w") {
          value = migrateParameters(
            value,
            target.relearning_steps.length,
            target.enable_short_term
          );
          _this.forgetting_curve = forgetting_curve.bind(this, value);
          _this.intervalModifier = _this.calculate_interval_modifier(
            Number(target.request_retention)
          );
        }
        Reflect.set(target, prop, value);
        return true;
      }
    };
  }
  useStrategy(mode, handler) {
    this.strategyHandler.set(mode, handler);
    return this;
  }
  clearStrategy(mode) {
    if (mode) {
      this.strategyHandler.delete(mode);
    } else {
      this.strategyHandler.clear();
    }
    return this;
  }
  getScheduler(card, now) {
    const schedulerStrategy = this.strategyHandler.get(
      StrategyMode.SCHEDULER
    );
    const Scheduler = schedulerStrategy || this.Scheduler;
    const instance = new Scheduler(card, now, this, this.strategyHandler);
    return instance;
  }
  /**
   * Display the collection of cards and logs for the four scenarios after scheduling the card at the current time.
   * @param card Card to be processed
   * @param now Current time or scheduled time
   * @param afterHandler Convert the result to another type. (Optional)
   * @example
   * ```typescript
   * const card: Card = createEmptyCard(new Date());
   * const f = fsrs();
   * const recordLog = f.repeat(card, new Date());
   * ```
   * @example
   * ```typescript
   * interface RevLogUnchecked
   *   extends Omit<ReviewLog, "due" | "review" | "state" | "rating"> {
   *   cid: string;
   *   due: Date | number;
   *   state: StateType;
   *   review: Date | number;
   *   rating: RatingType;
   * }
   *
   * interface RepeatRecordLog {
   *   card: CardUnChecked; //see method: createEmptyCard
   *   log: RevLogUnchecked;
   * }
   *
   * function repeatAfterHandler(recordLog: RecordLog) {
   *     const record: { [key in Grade]: RepeatRecordLog } = {} as {
   *       [key in Grade]: RepeatRecordLog;
   *     };
   *     for (const grade of Grades) {
   *       record[grade] = {
   *         card: {
   *           ...(recordLog[grade].card as Card & { cid: string }),
   *           due: recordLog[grade].card.due.getTime(),
   *           state: State[recordLog[grade].card.state] as StateType,
   *           last_review: recordLog[grade].card.last_review
   *             ? recordLog[grade].card.last_review!.getTime()
   *             : null,
   *         },
   *         log: {
   *           ...recordLog[grade].log,
   *           cid: (recordLog[grade].card as Card & { cid: string }).cid,
   *           due: recordLog[grade].log.due.getTime(),
   *           review: recordLog[grade].log.review.getTime(),
   *           state: State[recordLog[grade].log.state] as StateType,
   *           rating: Rating[recordLog[grade].log.rating] as RatingType,
   *         },
   *       };
   *     }
   *     return record;
   * }
   * const card: Card = createEmptyCard(new Date(), cardAfterHandler); //see method:  createEmptyCard
   * const f = fsrs();
   * const recordLog = f.repeat(card, new Date(), repeatAfterHandler);
   * ```
   */
  repeat(card, now, afterHandler) {
    const instance = this.getScheduler(card, now);
    const recordLog = instance.preview();
    return applyAfterHandler(recordLog, afterHandler);
  }
  /**
   * Display the collection of cards and logs for the card scheduled at the current time, after applying a specific grade rating.
   * @param card Card to be processed
   * @param now Current time or scheduled time
   * @param grade Rating of the review (Again, Hard, Good, Easy)
   * @param afterHandler Convert the result to another type. (Optional)
   * @example
   * ```typescript
   * const card: Card = createEmptyCard(new Date());
   * const f = fsrs();
   * const recordLogItem = f.next(card, new Date(), Rating.Again);
   * ```
   * @example
   * ```typescript
   * interface RevLogUnchecked
   *   extends Omit<ReviewLog, "due" | "review" | "state" | "rating"> {
   *   cid: string;
   *   due: Date | number;
   *   state: StateType;
   *   review: Date | number;
   *   rating: RatingType;
   * }
   *
   * interface NextRecordLog {
   *   card: CardUnChecked; //see method: createEmptyCard
   *   log: RevLogUnchecked;
   * }
   *
  function nextAfterHandler(recordLogItem: RecordLogItem) {
    const recordItem = {
      card: {
        ...(recordLogItem.card as Card & { cid: string }),
        due: recordLogItem.card.due.getTime(),
        state: State[recordLogItem.card.state] as StateType,
        last_review: recordLogItem.card.last_review
          ? recordLogItem.card.last_review!.getTime()
          : null,
      },
      log: {
        ...recordLogItem.log,
        cid: (recordLogItem.card as Card & { cid: string }).cid,
        due: recordLogItem.log.due.getTime(),
        review: recordLogItem.log.review.getTime(),
        state: State[recordLogItem.log.state] as StateType,
        rating: Rating[recordLogItem.log.rating] as RatingType,
      },
    };
    return recordItem
  }
   * const card: Card = createEmptyCard(new Date(), cardAfterHandler); //see method:  createEmptyCard
   * const f = fsrs();
   * const recordLogItem = f.repeat(card, new Date(), Rating.Again, nextAfterHandler);
   * ```
   */
  next(card, now, grade, afterHandler) {
    const instance = this.getScheduler(card, now);
    const g = TypeConvert.rating(grade);
    if (g === Rating.Manual) {
      throw new FSRSValidationError("Cannot review a manual rating");
    }
    const recordLogItem = instance.review(g);
    return applyAfterHandler(recordLogItem, afterHandler);
  }
  /**
   * Get the retrievability of the card
   * @param card  Card to be processed
   * @param now  Current time or scheduled time
   * @param format  default:true , Convert the result to another type. (Optional)
   * @returns  The retrievability of the card,if format is true, the result is a string, otherwise it is a number
   */
  get_retrievability(card, now, format = true) {
    const processedCard = TypeConvert.card(card);
    now = now ? TypeConvert.time(now) : /* @__PURE__ */ new Date();
    const t = processedCard.state !== State.New ? Math.max(date_diff(now, processedCard.last_review, "days"), 0) : 0;
    const r = processedCard.state !== State.New ? this.forgetting_curve(t, +processedCard.stability.toFixed(8)) : 0;
    return format ? `${(r * 100).toFixed(2)}%` : r;
  }
  /**
   *
   * @param card Card to be processed
   * @param log last review log
   * @param afterHandler Convert the result to another type. (Optional)
   * @example
   * ```typescript
   * const now = new Date();
   * const f = fsrs();
   * const emptyCardFormAfterHandler = createEmptyCard(now);
   * const repeatFormAfterHandler = f.repeat(emptyCardFormAfterHandler, now);
   * const { card, log } = repeatFormAfterHandler[Rating.Hard];
   * const rollbackFromAfterHandler = f.rollback(card, log);
   * ```
   *
   * @example
   * ```typescript
   * const now = new Date();
   * const f = fsrs();
   * const emptyCardFormAfterHandler = createEmptyCard(now, cardAfterHandler);  //see method: createEmptyCard
   * const repeatFormAfterHandler = f.repeat(emptyCardFormAfterHandler, now, repeatAfterHandler); //see method: fsrs.repeat()
   * const { card, log } = repeatFormAfterHandler[Rating.Hard];
   * const rollbackFromAfterHandler = f.rollback(card, log, cardAfterHandler);
   * ```
   */
  rollback(card, log, afterHandler) {
    const processedCard = TypeConvert.card(card);
    const processedLog = TypeConvert.review_log(log);
    if (processedLog.rating === Rating.Manual) {
      throw new FSRSValidationError("Cannot rollback a manual rating");
    }
    let last_due;
    let last_review;
    let last_lapses;
    switch (processedLog.state) {
      case State.New:
        last_due = processedLog.due;
        last_review = void 0;
        last_lapses = 0;
        break;
      case State.Learning:
      case State.Relearning:
      case State.Review:
        last_due = processedLog.review;
        last_review = processedLog.due;
        last_lapses = processedCard.lapses - (processedLog.rating === Rating.Again && processedLog.state === State.Review ? 1 : 0);
        break;
    }
    const prevCard = {
      ...processedCard,
      due: last_due,
      stability: processedLog.stability,
      difficulty: processedLog.difficulty,
      elapsed_days: processedLog.last_elapsed_days,
      scheduled_days: processedLog.scheduled_days,
      reps: Math.max(0, processedCard.reps - 1),
      lapses: Math.max(0, last_lapses),
      learning_steps: processedLog.learning_steps,
      state: processedLog.state,
      last_review
    };
    return applyAfterHandler(prevCard, afterHandler);
  }
  /**
   *
   * @param card Card to be processed
   * @param now Current time or scheduled time
   * @param reset_count Should the review count information(reps,lapses) be reset. (Optional)
   * @param afterHandler Convert the result to another type. (Optional)
   * @example
   * ```typescript
   * const now = new Date();
   * const f = fsrs();
   * const emptyCard = createEmptyCard(now);
   * const scheduling_cards = f.repeat(emptyCard, now);
   * const { card, log } = scheduling_cards[Rating.Hard];
   * const forgetCard = f.forget(card, new Date(), true);
   * ```
   *
   * @example
   * ```typescript
   * interface RepeatRecordLog {
   *   card: CardUnChecked; //see method: createEmptyCard
   *   log: RevLogUnchecked; //see method: fsrs.repeat()
   * }
   *
   * function forgetAfterHandler(recordLogItem: RecordLogItem): RepeatRecordLog {
   *     return {
   *       card: {
   *         ...(recordLogItem.card as Card & { cid: string }),
   *         due: recordLogItem.card.due.getTime(),
   *         state: State[recordLogItem.card.state] as StateType,
   *         last_review: recordLogItem.card.last_review
   *           ? recordLogItem.card.last_review!.getTime()
   *           : null,
   *       },
   *       log: {
   *         ...recordLogItem.log,
   *         cid: (recordLogItem.card as Card & { cid: string }).cid,
   *         due: recordLogItem.log.due.getTime(),
   *         review: recordLogItem.log.review.getTime(),
   *         state: State[recordLogItem.log.state] as StateType,
   *         rating: Rating[recordLogItem.log.rating] as RatingType,
   *       },
   *     };
   * }
   * const now = new Date();
   * const f = fsrs();
   * const emptyCardFormAfterHandler = createEmptyCard(now, cardAfterHandler); //see method:  createEmptyCard
   * const repeatFormAfterHandler = f.repeat(emptyCardFormAfterHandler, now, repeatAfterHandler); //see method: fsrs.repeat()
   * const { card } = repeatFormAfterHandler[Rating.Hard];
   * const forgetFromAfterHandler = f.forget(card, date_scheduler(now, 1, true), false, forgetAfterHandler);
   * ```
   */
  forget(card, now, reset_count = false, afterHandler) {
    const processedCard = TypeConvert.card(card);
    now = TypeConvert.time(now);
    const scheduled_days = processedCard.state === State.New ? 0 : date_diff(now, processedCard.due, "days");
    const forget_log = {
      rating: Rating.Manual,
      state: processedCard.state,
      due: processedCard.due,
      stability: processedCard.stability,
      difficulty: processedCard.difficulty,
      elapsed_days: 0,
      last_elapsed_days: processedCard.elapsed_days,
      scheduled_days,
      learning_steps: processedCard.learning_steps,
      review: now
    };
    const forget_card = {
      ...processedCard,
      due: now,
      stability: 0,
      difficulty: 0,
      elapsed_days: 0,
      scheduled_days: 0,
      reps: reset_count ? 0 : processedCard.reps,
      lapses: reset_count ? 0 : processedCard.lapses,
      learning_steps: 0,
      state: State.New,
      last_review: processedCard.last_review
    };
    const recordLogItem = { card: forget_card, log: forget_log };
    return applyAfterHandler(recordLogItem, afterHandler);
  }
  /**
   * Reschedules the current card and returns the rescheduled collections and reschedule item.
   *
   * @template T - The type of the record log item.
   * @param {CardInput | Card} current_card - The current card to be rescheduled.
   * @param {Array<FSRSHistory>} reviews - The array of FSRSHistory objects representing the reviews.
   * @param {Partial<RescheduleOptions<T>>} options - The optional reschedule options.
   * @returns {IReschedule<T>} - The rescheduled collections and reschedule item.
   *
   * @example
   * ```typescript
   * const f = fsrs()
   * const grades: Grade[] = [Rating.Good, Rating.Good, Rating.Good, Rating.Good]
   * const reviews_at = [
   *   new Date(2024, 8, 13),
   *   new Date(2024, 8, 13),
   *   new Date(2024, 8, 17),
   *   new Date(2024, 8, 28),
   * ]
   *
   * const reviews: FSRSHistory[] = []
   * for (let i = 0; i < grades.length; i++) {
   *   reviews.push({
   *     rating: grades[i],
   *     review: reviews_at[i],
   *   })
   * }
   *
   * const results_short = scheduler.reschedule(
   *   createEmptyCard(),
   *   reviews,
   *   {
   *     skipManual: false,
   *   }
   * )
   * console.log(results_short)
   * ```
   */
  reschedule(current_card, reviews = [], options = {}) {
    const {
      recordLogHandler,
      reviewsOrderBy,
      skipManual = true,
      now = /* @__PURE__ */ new Date(),
      update_memory_state: updateMemoryState = false
    } = options;
    if (reviewsOrderBy && typeof reviewsOrderBy === "function") {
      reviews.sort(reviewsOrderBy);
    }
    if (skipManual) {
      reviews = reviews.filter((review) => review.rating !== Rating.Manual);
    }
    const rescheduleSvc = new Reschedule(this);
    const collections = rescheduleSvc.reschedule(
      options.first_card || createEmptyCard(),
      reviews
    );
    const len = collections.length;
    const cur_card = TypeConvert.card(current_card);
    const manual_item = rescheduleSvc.calculateManualRecord(
      cur_card,
      now,
      len ? collections[len - 1] : void 0,
      updateMemoryState
    );
    return {
      collections: typeof recordLogHandler === "function" ? collections.map(recordLogHandler) : collections,
      reschedule_item: manual_item ? applyAfterHandler(manual_item, recordLogHandler) : null
    };
  }
};
var fsrs = (params) => {
  return new FSRS(params || {});
};

// src/scheduler.js
var FSRS_VERSION = "ts-fsrs@5.4.1";
function createScheduler(retention = 0.9) {
  return fsrs({
    request_retention: Math.min(0.97, Math.max(0.75, Number(retention) || 0.9)),
    maximum_interval: 36500,
    enable_fuzz: true,
    enable_short_term: false,
    learning_steps: [],
    relearning_steps: []
  });
}
function emptyCard(now = Date.now()) {
  return serializeCard(createEmptyCard(new Date(now)));
}
function serializeCard(card) {
  return {
    due: new Date(card.due).getTime(),
    stability: Number(card.stability) || 0,
    difficulty: Number(card.difficulty) || 0,
    elapsed_days: Number(card.elapsed_days) || 0,
    scheduled_days: Number(card.scheduled_days) || 0,
    reps: Number(card.reps) || 0,
    lapses: Number(card.lapses) || 0,
    learning_steps: Number(card.learning_steps) || 0,
    state: Number(card.state) || 0,
    last_review: card.last_review ? new Date(card.last_review).getTime() : null
  };
}
function hydrateCard(card, now = Date.now()) {
  if (!card) return createEmptyCard(new Date(now));
  return {
    due: new Date(Number(card.due) || now),
    stability: Number(card.stability) || 0,
    difficulty: Number(card.difficulty) || 0,
    elapsed_days: Number(card.elapsed_days) || 0,
    scheduled_days: Number(card.scheduled_days) || 0,
    reps: Number(card.reps) || 0,
    lapses: Number(card.lapses) || 0,
    learning_steps: Number(card.learning_steps) || 0,
    state: Number(card.state) || 0,
    last_review: card.last_review ? new Date(Number(card.last_review)) : void 0
  };
}
function gradeFromResult(result) {
  return result === "bad" ? Rating.Again : Rating.Good;
}
function advanceCard(card, event, retention = 0.9) {
  const scheduler = createScheduler(retention);
  const result = scheduler.next(
    hydrateCard(card, event.ts),
    new Date(event.ts),
    gradeFromResult(event.result)
  );
  return serializeCard(result.card);
}
function rebuildCard(events, retention = 0.9) {
  const cold = [...events].filter((event) => event.cold && (event.result === "good" || event.result === "bad")).sort((a, b) => a.ts - b.ts);
  let card = emptyCard(cold[0]?.ts || Date.now());
  for (const event of cold) card = advanceCard(card, event, retention);
  return card;
}
function retrievability(card, now = Date.now(), retention = 0.9) {
  if (!card || !card.reps) return 0;
  try {
    return createScheduler(retention).get_retrievability(hydrateCard(card, now), new Date(now), false);
  } catch {
    return 0;
  }
}

// src/storage.js
var DB_NAME = "listenwrite-v3";
var DB_VERSION = 1;
var STORE = "kv";
var STATE_KEY = "state";
var LEGACY_KEY = "listenwrite-v2";
var FALLBACK_KEY = "listenwrite-v3-fallback";
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function dbGet(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}
async function dbSet(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
function defaultState() {
  return { version: 3, words: [], events: [], texts: [], dailyPlans: {}, activities: [], settings: { newTarget: 30, reviewTarget: 80, retention: 0.9, speechRate: 0.92, todayBooks: [], typeBooks: [] } };
}
function sampleWords() {
  return [["distribution", "\u5206\u5E03\uFF1B\u5206\u914D", "n.", "the way something is spread or shared"], ["rural", "\u4E61\u6751\u7684\uFF1B\u519C\u6751\u7684", "adj.", "connected with the countryside"], ["decline", "\u4E0B\u964D\uFF1B\u51CF\u5C11", "n./v.", "to become smaller, fewer or less"], ["agriculture", "\u519C\u4E1A", "n.", "the practice of farming"], ["significant", "\u663E\u8457\u7684\uFF1B\u91CD\u8981\u7684", "adj.", "large or important enough to be noticed"]].map(([en, zh, pos, def], i) => ({ id: `sample_${i + 1}`, en, zh, pos, def, sources: ["\u793A\u4F8B\u8BCD\u5E93"], examples: [], retired: false, card: emptyCard() }));
}
function normalizeWord(word, index) {
  return { id: word.id || `w_${Date.now().toString(36)}_${index}`, en: String(word.en || "").trim().toLowerCase(), zh: String(word.zh || ""), pos: String(word.pos || ""), def: String(word.def || ""), sources: Array.isArray(word.sources) ? [...new Set(word.sources)] : Array.isArray(word.src) ? [...new Set(word.src)] : [], examples: Array.isArray(word.examples) ? [...new Set(word.examples)] : Array.isArray(word.ex) ? [...new Set(word.ex)] : [], retired: Boolean(word.retired ?? word.ret), card: word.card || null };
}
function normalizeEvent(event, index) {
  return { id: event.id || `legacy_ev_${index}`, wordId: event.wordId, date: event.date, ts: Number(event.ts) || Date.now(), mode: event.mode === "type" ? "type" : "listen", result: event.result || event.res || "bad", originalResult: event.originalResult || event.result || event.res || "bad", cold: Boolean(event.cold), attempt: Number(event.attempt) || 1, source: event.source || null, sentence: event.sentence || null, editedAt: event.editedAt || null };
}
function normalizePlan(plan, key) {
  return { date: plan.date || key, books: Array.isArray(plan.books) ? plan.books : [], newTarget: Number(plan.newTarget) || 0, reviewTarget: Number(plan.reviewTarget) || 0, newIds: Array.isArray(plan.newIds) ? plan.newIds : [], reviewIds: Array.isArray(plan.reviewIds) ? plan.reviewIds : [], createdAt: Number(plan.createdAt) || Date.now(), updatedAt: Number(plan.updatedAt) || Date.now() };
}
function normalizeState(input) {
  const base = defaultState(), legacy = Boolean(input?.set && !input?.settings), state2 = { ...base, ...input || {} };
  state2.settings = { ...base.settings, ...input?.settings || input?.set || {} };
  if (input?.set) {
    state2.settings.newTarget = Number(input.set.newN ?? state2.settings.newTarget);
    state2.settings.reviewTarget = Number(input.set.reviewN ?? state2.settings.reviewTarget);
    state2.settings.speechRate = Number(input.set.rate ?? state2.settings.speechRate);
    state2.settings.todayBooks = Array.isArray(input.set.todayBooks) ? input.set.todayBooks : [];
    state2.settings.typeBooks = Array.isArray(input.set.typeBooks) ? input.set.typeBooks : [];
  }
  state2.settings.retention = Math.min(0.97, Math.max(0.75, Number(state2.settings.retention) || 0.9));
  state2.words = (input?.words || []).map(normalizeWord).filter((w) => w.en);
  state2.events = (input?.events || []).map(normalizeEvent).filter((e) => e.wordId);
  state2.texts = Array.isArray(input?.texts) ? input.texts : [];
  state2.activities = Array.isArray(input?.activities) ? input.activities : [];
  state2.dailyPlans = {};
  if (!legacy && input?.dailyPlans && typeof input.dailyPlans === "object" && !Array.isArray(input.dailyPlans)) {
    for (const [key, plan] of Object.entries(input.dailyPlans)) state2.dailyPlans[key] = normalizePlan(plan, key);
  }
  for (const word of state2.words) {
    const evs = state2.events.filter((e) => e.wordId === word.id && e.cold).sort((a, b) => a.ts - b.ts);
    word.card = evs.length ? rebuildCard(evs, state2.settings.retention) : word.card || emptyCard();
  }
  state2.version = 3;
  return state2;
}
async function parseLocal(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? normalizeState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}
async function loadState() {
  try {
    const saved = await dbGet(STATE_KEY);
    if (saved) return normalizeState(saved);
    const fallback = await parseLocal(FALLBACK_KEY);
    if (fallback) {
      await dbSet(STATE_KEY, fallback);
      return fallback;
    }
    const legacy = await parseLocal(LEGACY_KEY);
    const state2 = legacy || defaultState();
    if (!state2.words.length) state2.words = sampleWords();
    await dbSet(STATE_KEY, state2);
    return state2;
  } catch {
    const fallback = await parseLocal(FALLBACK_KEY);
    if (fallback) return fallback;
    const legacy = await parseLocal(LEGACY_KEY);
    const state2 = legacy || defaultState();
    if (!state2.words.length) state2.words = sampleWords();
    return state2;
  }
}
async function saveState(state2) {
  state2.version = 3;
  try {
    await dbSet(STATE_KEY, state2);
    localStorage.removeItem(FALLBACK_KEY);
  } catch {
    localStorage.setItem(FALLBACK_KEY, JSON.stringify(state2));
  }
}
async function replaceState(raw) {
  const state2 = normalizeState(raw);
  await saveState(state2);
  return state2;
}
function exportState(state2) {
  return JSON.stringify(state2, null, 2);
}

// src/engine.js
function dayKey(ts = Date.now()) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
function wordEvents(state2, wordId) {
  return state2.events.filter((e) => e.wordId === wordId).sort((a, b) => a.ts - b.ts);
}
function eventsOnDay(state2, wordId, date = dayKey(), mode = null) {
  return state2.events.filter((e) => e.wordId === wordId && e.date === date && (!mode || e.mode === mode)).sort((a, b) => a.ts - b.ts);
}
function latestEventOnDay(state2, wordId, date = dayKey(), mode = null) {
  const list = eventsOnDay(state2, wordId, date, mode);
  return list[list.length - 1] || null;
}
function hasEventBefore(state2, wordId, date = dayKey()) {
  return state2.events.some((e) => e.wordId === wordId && e.date < date);
}
function recordAttempt(state2, word, mode, result, context = {}) {
  const ts = context.ts || Date.now();
  const date = dayKey(ts);
  const cold = !state2.events.some((e) => e.wordId === word.id && e.date === date);
  const attempt = eventsOnDay(state2, word.id, date, mode).length + 1;
  const event = {
    id: uid("ev"),
    wordId: word.id,
    date,
    ts,
    mode,
    result,
    originalResult: result,
    cold,
    attempt,
    source: context.source || null,
    sentence: context.sentence || null,
    editedAt: null
  };
  state2.events.push(event);
  if (!word.card) word.card = emptyCard(ts);
  if (cold) word.card = advanceCard(word.card, event, state2.settings.retention);
  return event;
}
function editAttempt(state2, eventId, result) {
  const event = state2.events.find((e) => e.id === eventId);
  if (!event || event.result === result) return event || null;
  event.result = result;
  event.editedAt = Date.now();
  const word = state2.words.find((w) => w.id === event.wordId);
  if (word && event.cold) word.card = rebuildCard(wordEvents(state2, word.id), state2.settings.retention);
  return event;
}
function rebuildAllCards(state2) {
  for (const word of state2.words) {
    const events = wordEvents(state2, word.id);
    word.card = events.some((e) => e.cold) ? rebuildCard(events, state2.settings.retention) : word.card || emptyCard();
  }
}

// src/queue.js
function allBooks(state2) {
  const set = /* @__PURE__ */ new Set();
  for (const word of state2.words) for (const source of word.sources || []) set.add(source);
  return [...set].sort((a, b) => a.localeCompare(b));
}
function matchesBooks(word, books = []) {
  return !books.length || (word.sources || []).some((source) => books.includes(source));
}
function endOfDay(date) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d + 1).getTime() - 1;
}
function sameBooks(a = [], b = []) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}
function listenedToday(state2, id, date) {
  return state2.events.some((e) => e.wordId === id && e.date === date && e.mode === "listen");
}
function seedTodayFromListenHistory(state2, plan) {
  const seen = /* @__PURE__ */ new Set([...plan.newIds, ...plan.reviewIds]);
  const listenedIds = [...new Set(state2.events.filter((e) => e.date === plan.date && e.mode === "listen").map((e) => e.wordId))];
  for (const id of listenedIds) {
    if (seen.has(id)) continue;
    if (hasEventBefore(state2, id, plan.date)) plan.reviewIds.push(id);
    else plan.newIds.push(id);
    seen.add(id);
  }
}
function reconcileScope(state2, plan, books) {
  if (sameBooks(plan.books, books)) return;
  const keep = (id) => listenedToday(state2, id, plan.date) || matchesBooks(state2.words.find((w) => w.id === id) || {}, books);
  plan.newIds = plan.newIds.filter(keep);
  plan.reviewIds = plan.reviewIds.filter(keep);
  plan.books = [...books];
}
function trimToTarget(state2, plan, key, target) {
  const ids = plan[key];
  const attempted = ids.filter((id) => listenedToday(state2, id, plan.date));
  const untouched = ids.filter((id) => !listenedToday(state2, id, plan.date));
  const keepUntouched = Math.max(0, target - attempted.length);
  plan[key] = [...attempted, ...untouched.slice(0, keepUntouched)];
}
function ensureDailyPlan(state2, options = {}) {
  const date = options.date || dayKey();
  let plan = state2.dailyPlans[date];
  if (!plan) {
    plan = state2.dailyPlans[date] = { date, books: [...options.books || state2.settings.todayBooks || []], newTarget: Number(options.newTarget ?? state2.settings.newTarget) || 0, reviewTarget: Number(options.reviewTarget ?? state2.settings.reviewTarget) || 0, newIds: [], reviewIds: [], createdAt: Date.now(), updatedAt: Date.now() };
  }
  if (options.books) reconcileScope(state2, plan, options.books);
  if (options.newTarget != null) plan.newTarget = Math.max(0, Number(options.newTarget) || 0);
  if (options.reviewTarget != null) plan.reviewTarget = Math.max(0, Number(options.reviewTarget) || 0);
  seedTodayFromListenHistory(state2, plan);
  trimToTarget(state2, plan, "newIds", plan.newTarget);
  trimToTarget(state2, plan, "reviewIds", plan.reviewTarget);
  fillDailyPlan(state2, plan);
  plan.updatedAt = Date.now();
  return plan;
}
function fillDailyPlan(state2, plan) {
  const assigned = /* @__PURE__ */ new Set([...plan.newIds, ...plan.reviewIds]);
  const pool = state2.words.filter((w) => !w.retired && matchesBooks(w, plan.books));
  const cutoff = endOfDay(plan.date), now = Date.now();
  const review = pool.filter((w) => !assigned.has(w.id) && hasEventBefore(state2, w.id, plan.date) && (w.card?.reps || 0) > 0 && Number(w.card?.due || 0) <= cutoff);
  review.sort((a, b) => {
    const ra = retrievability(a.card, now, state2.settings.retention), rb = retrievability(b.card, now, state2.settings.retention);
    if (ra !== rb) return ra - rb;
    return Number(a.card?.due || 0) - Number(b.card?.due || 0);
  });
  const fresh = pool.filter((w) => !assigned.has(w.id) && !hasEventBefore(state2, w.id, plan.date));
  fresh.sort((a, b) => (b.sources?.length || 0) - (a.sources?.length || 0) || a.en.localeCompare(b.en));
  const needReview = Math.max(0, plan.reviewTarget - plan.reviewIds.length), needNew = Math.max(0, plan.newTarget - plan.newIds.length);
  for (const w of review.slice(0, needReview)) {
    plan.reviewIds.push(w.id);
    assigned.add(w.id);
  }
  for (const w of fresh.slice(0, needNew)) {
    plan.newIds.push(w.id);
    assigned.add(w.id);
  }
  return plan;
}
function latestListenResult(state2, wordId, date = dayKey()) {
  return latestEventOnDay(state2, wordId, date, "listen");
}
function planStatus(state2, plan) {
  const wordMap = new Map(state2.words.map((w) => [w.id, w]));
  const statusFor = (ids) => {
    let done = 0, retry = 0, pending = 0;
    const doneIds = [], retryIds = [], pendingIds = [];
    for (const id of ids) {
      const word = wordMap.get(id);
      if (!word) continue;
      if (word.retired) {
        done++;
        doneIds.push(id);
        continue;
      }
      const last = latestListenResult(state2, id, plan.date);
      if (!last) {
        pending++;
        pendingIds.push(id);
      } else if (last.result === "good") {
        done++;
        doneIds.push(id);
      } else {
        retry++;
        retryIds.push(id);
      }
    }
    return { done, retry, pending, doneIds, retryIds, pendingIds };
  };
  return { new: statusFor(plan.newIds), review: statusFor(plan.reviewIds) };
}
function todayListeningStats(state2, books = [], date = dayKey()) {
  const allowed = new Set(state2.words.filter((w) => matchesBooks(w, books)).map((w) => w.id)), events = state2.events.filter((e) => e.date === date && e.mode === "listen" && allowed.has(e.wordId)), ids = [...new Set(events.map((e) => e.wordId))];
  let newCount = 0, reviewCount = 0, firstGood = 0, firstBad = 0;
  for (const id of ids) {
    if (hasEventBefore(state2, id, date)) reviewCount++;
    else newCount++;
    const first = eventsOnDay(state2, id, date, "listen")[0];
    if (first?.result === "good") firstGood++;
    else if (first) firstBad++;
  }
  return { events, ids, newCount, reviewCount, firstGood, firstBad };
}
function createRetrySession(state2, plan, mode = "listen", explicitIds = null) {
  const planIds = explicitIds || [...plan.reviewIds, ...plan.newIds], wordMap = new Map(state2.words.map((w) => [w.id, w]));
  const pendingBase = [], retry = [];
  if (explicitIds) {
    for (const id of [...new Set(planIds)]) {
      const word = wordMap.get(id);
      if (word && !word.retired) pendingBase.push(id);
    }
  } else {
    for (const id of planIds) {
      const word = wordMap.get(id);
      if (!word || word.retired) continue;
      const last = latestEventOnDay(state2, id, plan.date, mode);
      if (!last) pendingBase.push(id);
      else if (last.result === "bad") retry.push({ wordId: id, attempt: eventsOnDay(state2, id, plan.date, mode).length, eligibleTurn: 0, addedAt: last.ts });
    }
  }
  return { mode, date: plan.date, fixedIds: [...new Set(planIds)], pendingBase, retry, turn: 0, current: null, history: [] };
}
function retryGap(attempt) {
  if (attempt <= 1) return 4;
  if (attempt === 2) return 6;
  return 8;
}
function pickNext(session) {
  if (session.current) return session.current.wordId;
  const due = session.retry.filter((x) => x.eligibleTurn <= session.turn).sort((a, b) => a.eligibleTurn - b.eligibleTurn || a.addedAt - b.addedAt)[0];
  if (due) {
    session.retry = session.retry.filter((x) => x !== due);
    session.current = { wordId: due.wordId, source: "retry", attempt: due.attempt + 1 };
    return due.wordId;
  }
  const baseId = session.pendingBase.shift();
  if (baseId) {
    session.current = { wordId: baseId, source: "base", attempt: 1 };
    return baseId;
  }
  const nextRetry = session.retry.sort((a, b) => a.eligibleTurn - b.eligibleTurn || a.addedAt - b.addedAt).shift();
  if (nextRetry) {
    session.current = { wordId: nextRetry.wordId, source: "retry", attempt: nextRetry.attempt + 1 };
    return nextRetry.wordId;
  }
  return null;
}
function finishCurrent(session, result) {
  if (!session.current) return;
  const current = session.current;
  session.history.push({ ...current, result, turn: session.turn });
  session.turn += 1;
  session.retry = session.retry.filter((x) => x.wordId !== current.wordId);
  if (result === "bad") session.retry.push({ wordId: current.wordId, attempt: current.attempt, eligibleTurn: session.turn + retryGap(current.attempt), addedAt: Date.now() });
  session.current = null;
}
function sessionProgress(state2, plan, session) {
  const status = planStatus(state2, plan);
  return { newDone: status.new.done, newTotal: plan.newIds.length, reviewDone: status.review.done, reviewTotal: plan.reviewIds.length, retry: status.new.retry + status.review.retry, remaining: status.new.pending + status.review.pending + status.new.retry + status.review.retry, turn: session?.turn || 0 };
}
function dueForecast(state2, days = 7) {
  const out = [], now = /* @__PURE__ */ new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    out.push({ date: dayKey(d.getTime()), count: 0 });
  }
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  for (const word of state2.words) {
    if (word.retired || !(word.card?.reps || 0)) continue;
    const due = Number(word.card.due), key = dayKey(due), row = out.find((x) => x.date === key);
    if (row) row.count++;
    else if (due < todayStart) out[0].count++;
  }
  return out;
}

// src/app.js
var root = document.getElementById("app");
var restoreInput = document.getElementById("file-restore");
var importInput = document.getElementById("file-import");
var textInput = document.getElementById("file-text");
var state;
var view = "home";
var listen = null;
var typeRun = null;
var textReaderId = null;
var textEditId = null;
var textFormOpen = false;
var statRange = 30;
var statDay = dayKey();
var statMonth = new Date((/* @__PURE__ */ new Date()).getFullYear(), (/* @__PURE__ */ new Date()).getMonth(), 1);
var labels = {
  home: ["\u9996\u9875", "\u542C\u8BCD"],
  today: ["\u4ECA\u65E5", "\u4ECA\u65E5\u5B66\u4E60"],
  type: ["\u624B\u6253", "\u624B\u6253\u5F3A\u5316"],
  text: ["\u6587\u672C", "\u6587\u672C\u5E93"],
  library: ["\u8BCD\u5E93", "\u8BCD\u5E93"],
  stats: ["\u7EDF\u8BA1", "\u5B66\u4E60\u7EDF\u8BA1"]
};
function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.style.display = "block";
  clearTimeout(toast.t);
  toast.t = setTimeout(() => {
    el.style.display = "none";
  }, 1500);
}
function persist() {
  void saveState(state);
}
function wordById(id) {
  return state.words.find((w) => w.id === id);
}
function pct(a, b) {
  return b ? `${Math.round(a * 100 / b)}%` : "\u2014";
}
function dateObj(key) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function download(name, text, type = "application/json") {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1e3);
}
function speak(text) {
  if (!window.speechSynthesis) return toast("\u5F53\u524D\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u6717\u8BFB");
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = Number(state.settings.speechRate) || 0.92;
  speechSynthesis.speak(u);
}
function startActivity(mode, label, books = []) {
  const a = { id: uid("act"), mode, label, books: [...books], date: dayKey(), start: Date.now(), lastTouch: Date.now(), activeMs: 0 };
  state.activities.push(a);
  persist();
  return a.id;
}
function touchActivity(id) {
  const a = state.activities.find((x) => x.id === id);
  if (!a) return;
  const now = Date.now();
  const last = a.lastTouch || a.start || now;
  a.activeMs = (a.activeMs || 0) + Math.max(0, Math.min(now - last, 9e4));
  a.lastTouch = now;
  persist();
}
function activityMinutes(mode = null, date = dayKey()) {
  const list = state.activities.filter((a) => a.date === date && (!mode || a.mode === mode));
  const ms = list.reduce((sum, a) => sum + (a.activeMs || Math.max(0, (a.end || a.start) - a.start) || 0), 0);
  return ms ? Math.max(1, Math.round(ms / 6e4)) : 0;
}
function navHtml() {
  const items = [["home", "\u9996\u9875"], ["today", "\u4ECA\u65E5"], ["type", "\u624B\u6253"], ["text", "\u6587\u672C"], ["library", "\u8BCD\u5E93"]];
  return `<nav class="nav">${items.map(([id, t]) => `<button data-nav="${id}" class="${view === id ? "on" : ""}">${t}</button>`).join("")}</nav>`;
}
function shell(content) {
  const [ey, title] = labels[view] || ["", ""];
  root.innerHTML = `<main class="shell"><header class="topbar"><div><div class="eyebrow">${ey}</div><h1>${title}</h1></div><button id="backupTop" class="soft">\u5907\u4EFD</button></header>${content}</main>${navHtml()}`;
  document.querySelectorAll("[data-nav]").forEach((b) => b.onclick = () => go(b.dataset.nav));
  document.getElementById("backupTop").onclick = backup;
}
function go(next) {
  speechSynthesis?.cancel();
  view = next;
  listen = null;
  typeRun = null;
  textReaderId = null;
  render();
}
function bookChips(selected, scope) {
  const books = allBooks(state);
  return `<div class="chips"><button class="chip ${selected.length ? "" : "on"}" data-book-scope="${scope}" data-book="__all__">\u5168\u90E8\u8BCD\u4E66</button>${books.map((b) => `<button class="chip ${selected.includes(b) ? "on" : ""}" data-book-scope="${scope}" data-book="${esc(b)}">${esc(b)}</button>`).join("")}</div>`;
}
function bindBookChips(scope, rerender) {
  document.querySelectorAll(`[data-book-scope="${scope}"]`).forEach((b) => b.onclick = () => {
    const key = scope === "type" ? "typeBooks" : "todayBooks";
    const name = b.dataset.book;
    if (name === "__all__") state.settings[key] = [];
    else {
      const a = [...state.settings[key]];
      const i = a.indexOf(name);
      i >= 0 ? a.splice(i, 1) : a.push(name);
      state.settings[key] = a;
    }
    persist();
    rerender();
  });
}
function dueCount() {
  return state.words.filter((w) => !w.retired && (w.card?.reps || 0) && Number(w.card.due) <= Date.now()).length;
}
function renderHome() {
  const today = todayListeningStats(state, []);
  const mins = activityMinutes(null);
  const texts = state.texts.length;
  shell(`<div class="stack"><section class="card hero"><h2>\u542C\u8BCD</h2><p>\u9996\u9875\u53EA\u653E\u603B\u89C8\u548C\u5165\u53E3\u3002\u5B66\u4E60\u8BA1\u5212\u3001\u8BCD\u4E66\u8303\u56F4\u3001\u7B5B\u9009\u548C\u7EDF\u8BA1\u5404\u81EA\u5728\u81EA\u5DF1\u7684\u9875\u9762\u91CC\u3002</p><div class="grid4" style="margin-top:16px"><div class="statbox"><b>${state.words.filter((w) => !w.retired).length}</b><span>\u8BCD\u5E93\u603B\u8BCD\u6570</span></div><div class="statbox"><b>${dueCount()}</b><span>\u5F53\u524D\u5230\u671F</span></div><div class="statbox"><b>${today.newCount + today.reviewCount}</b><span>\u4ECA\u65E5\u542C\u97F3\u8BCD\u6570</span></div><div class="statbox"><b>${mins}m</b><span>\u4ECA\u65E5\u5B66\u4E60\u65F6\u95F4</span></div></div></section><div class="grid2"><button id="goToday" class="entry"><b>\u4ECA\u65E5\u5B66\u4E60</b><span>\u65B0\u8BCD\u3001\u590D\u4E60\u3001\u5F85\u5DE9\u56FA\u4E00\u773C\u770B\u6E05\uFF0C\u518D\u5F00\u59CB\u542C\u97F3\u3002</span></button><button id="goType" class="entry"><b>\u624B\u6253\u5F3A\u5316</b><span>\u4ECE\u56F0\u96BE\u8BCD\u91CC\u505A\u66F4\u5F3A\u7684\u4E3B\u52A8\u63D0\u53D6\u3002</span></button><button id="goText" class="entry"><b>\u6587\u672C\u5E93</b><span>${texts} \u7BC7\u5DF2\u4FDD\u5B58\u6587\u672C\uFF0C\u9010\u53E5\u542C\u3001\u5FAA\u73AF\u548C\u9009\u8BCD\u5165\u5E93\u3002</span></button><button id="goStats" class="entry"><b>\u5B66\u4E60\u7EDF\u8BA1</b><span>\u9996\u8F6E\u719F\u6089\u7387\u3001\u5B8C\u6574\u6708\u5386\u3001\u56F0\u96BE\u8BCD\u548C\u672A\u6765\u590D\u4E60\u3002</span></button></div></div>`);
  document.getElementById("goToday").onclick = () => go("today");
  document.getElementById("goType").onclick = () => go("type");
  document.getElementById("goText").onclick = () => go("text");
  document.getElementById("goStats").onclick = () => go("stats");
}
function renderToday() {
  const books = state.settings.todayBooks || [];
  const plan = ensureDailyPlan(state, { books, newTarget: state.settings.newTarget, reviewTarget: state.settings.reviewTarget });
  persist();
  const status = planStatus(state, plan);
  const prog = sessionProgress(state, plan, null);
  const td = todayListeningStats(state, books);
  const mins = activityMinutes("listen");
  const selectedText = books.length ? books.join("\u3001") : "\u5168\u90E8\u8BCD\u4E66";
  const bookRows = (books.length ? books : allBooks(state)).map((b) => {
    const x = todayListeningStats(state, [b]);
    return `<div class="bookrow"><b>${esc(b)}</b><span>${x.newCount} \u65B0</span><span>${x.reviewCount} \u590D\u4E60</span><span class="mobilehide good">${x.firstGood} \u719F\u6089</span><span class="mobilehide bad">${x.firstBad} \u4E0D\u719F</span></div>`;
  }).join("");
  shell(`<div class="stack"><section class="card hero"><div class="space"><div><h2>\u4ECA\u5929\u5148\u5B8C\u6210\u8FD9\u4E00\u7EC4</h2><div class="small">${esc(selectedText)}</div></div><span class="tag">FSRS</span></div><div class="plan" style="margin-top:15px"><div class="statbox"><b>${prog.newDone} / ${prog.newTotal}</b><span>\u65B0\u8BCD</span><div class="progressline"><i style="width:${prog.newTotal ? prog.newDone * 100 / prog.newTotal : 0}%"></i></div></div><div class="statbox"><b>${prog.reviewDone} / ${prog.reviewTotal}</b><span>\u590D\u4E60</span><div class="progressline"><i style="width:${prog.reviewTotal ? prog.reviewDone * 100 / prog.reviewTotal : 0}%"></i></div></div><div class="statbox"><b class="${prog.retry ? "bad" : ""}">${prog.retry}</b><span>\u5F85\u5DE9\u56FA</span><div class="small">\u4E0D\u589E\u52A0\u65B0\u8BCD/\u590D\u4E60\u5206\u6BCD</div></div></div><div class="row" style="margin-top:16px"><button id="startListen" class="primary">${prog.remaining ? "\u7EE7\u7EED\u4ECA\u65E5\u542C\u97F3" : "\u4ECA\u65E5\u5DF2\u5B8C\u6210"}</button><span class="small">\u542C\u97F3 ${mins} \u5206\u949F \xB7 \u9996\u8F6E\u719F\u6089 ${pct(td.firstGood, td.firstGood + td.firstBad)}</span></div><details class="details"><summary>\u5B66\u4E60\u8BBE\u7F6E\u4E0E\u8BCD\u4E66\u8303\u56F4</summary><div style="margin-top:12px"><div class="small">\u5DF2\u5B89\u6392\u8FDB\u4ECA\u5929\u8BA1\u5212\u7684\u8BCD\u4E0D\u4F1A\u56E0\u4E3A\u5207\u6362\u8BCD\u4E66\u6D88\u5931\uFF1B\u65B0\u7684\u8865\u5165\u4EFB\u52A1\u4F1A\u6309\u5F53\u524D\u8303\u56F4\u9009\u62E9\u3002</div>${bookChips(books, "today")}<div class="grid2" style="margin-top:12px"><div class="field"><label>\u6BCF\u65E5\u65B0\u8BCD\u76EE\u6807</label><input id="newTarget" type="number" min="0" value="${state.settings.newTarget}"></div><div class="field"><label>\u6BCF\u65E5\u590D\u4E60\u76EE\u6807</label><input id="reviewTarget" type="number" min="0" value="${state.settings.reviewTarget}"></div></div></div></details></section><section class="card"><h2 class="section-title">\u4ECA\u65E5\u542C\u97F3\u6570\u636E</h2><div class="grid4" style="margin-top:13px"><div class="statbox"><b>${td.newCount}</b><span>\u542C\u97F3\u65B0\u8BCD</span></div><div class="statbox"><b>${td.reviewCount}</b><span>\u542C\u97F3\u590D\u4E60</span></div><div class="statbox"><b class="good">${td.firstGood}</b><span>\u9996\u8F6E\u719F\u6089</span></div><div class="statbox"><b class="bad">${td.firstBad}</b><span>\u9996\u8F6E\u4E0D\u719F</span></div></div></section><section class="card"><h2 class="section-title">\u5404\u8BCD\u4E66\u4ECA\u5929\u7684\u60C5\u51B5</h2><div class="small">\u53EA\u7EDF\u8BA1\u542C\u97F3\uFF0C\u4E0D\u6DF7\u5165\u624B\u6253\u3002</div><div style="margin-top:8px">${bookRows || '<div class="empty">\u8FD8\u6CA1\u6709\u8BCD\u4E66\u3002</div>'}</div></section></div>`);
  bindBookChips("today", renderToday);
  document.getElementById("newTarget").onchange = (e) => {
    state.settings.newTarget = Math.max(0, Number(e.target.value) || 0);
    persist();
    renderToday();
  };
  document.getElementById("reviewTarget").onchange = (e) => {
    state.settings.reviewTarget = Math.max(0, Number(e.target.value) || 0);
    persist();
    renderToday();
  };
  document.getElementById("startListen").onclick = () => {
    if (!prog.remaining) return toast("\u4ECA\u5929\u8FD9\u4E00\u7EC4\u5DF2\u7ECF\u5B8C\u6210");
    startListen(plan);
  };
}
function startListen(plan) {
  const session = createRetrySession(state, plan, "listen");
  const id = pickNext(session);
  if (!id) return toast("\u4ECA\u5929\u8FD9\u4E00\u7EC4\u5DF2\u7ECF\u5B8C\u6210");
  listen = { plan, session, currentEventId: null, result: null, answer: false, activityId: startActivity("listen", "\u4ECA\u65E5\u542C\u97F3", plan.books), historyView: null };
  renderListen();
  speak(wordById(id).en);
}
function listenCurrentWord() {
  const id = listen?.historyView?.wordId || listen?.session.current?.wordId;
  return wordById(id);
}
function renderListen() {
  const w = listenCurrentWord();
  if (!w) {
    listen = null;
    view = "today";
    renderToday();
    return;
  }
  const p = sessionProgress(state, listen.plan, listen.session);
  const reviewing = Boolean(listen.historyView);
  const result = reviewing ? listen.historyView.result : listen.result;
  const answer = reviewing || listen.answer;
  root.innerHTML = `<main class="immersive"><div class="studytop"><button id="listenBack" class="back">\u2039</button><div class="studyprogress">\u65B0\u8BCD ${p.newDone} / ${p.newTotal}\u3000\u590D\u4E60 ${p.reviewDone} / ${p.reviewTotal}${p.retry ? `\u3000\u5F85\u5DE9\u56FA ${p.retry}` : ""}</div>${!reviewing ? '<button id="retireWord" class="retire">\u9000\u51FA\u5FAA\u73AF</button>' : ""}</div><div class="studybody"><button id="speakWord" class="speaker">\u25D6))</button>${answer ? `<div class="word ${result === "good" ? "good" : result === "bad" ? "bad" : ""}">${esc(w.en)}</div><div class="meaning">${esc(w.zh || "\u6682\u65E0\u4E2D\u6587\u91CA\u4E49")}</div>${w.pos || w.def ? `<div class="meta">${esc(w.pos)}${w.def ? ` \xB7 ${esc(w.def)}` : ""}</div>` : ""}${w.examples?.length ? `<div class="example">${esc(w.examples[w.examples.length - 1])}</div>` : ""}<div class="source-tags">${(w.sources || []).map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div>` : '<div class="small">\u542C\u5230\u4EE5\u540E\uFF0C\u610F\u601D\u80FD\u4E0D\u80FD\u76F4\u63A5\u51FA\u6765\uFF1F</div>'}<div class="judges"><button id="judgeGood" class="goodbtn">1\u3000\u719F\u6089</button><button id="judgeBad" class="badbtn">2\u3000\u4E0D\u719F\u6089</button></div>${answer ? `<div class="move"><button id="prevWord" class="soft" ${listen.session.history.length ? "" : "disabled"}>\u4E0A\u4E00\u8BCD</button><button id="nextWord" class="primary">${reviewing ? "\u56DE\u5230\u5F53\u524D\u8BCD" : "\u4E0B\u4E00\u8BCD"}</button></div>` : ""}<div class="statusline">${reviewing ? "\u4FEE\u6539\u5386\u53F2\u5224\u65AD\u540E\u4F1A\u91CD\u65B0\u8BA1\u7B97\u5F53\u5929\u961F\u5217\u548C FSRS \u72B6\u6001\u3002" : "\u5F53\u5929\u7B2C\u4E00\u6B21\u5224\u65AD\u51B3\u5B9A\u8DE8\u5929\u8C03\u5EA6\uFF1B\u540E\u7EED\u91CD\u8BD5\u53EA\u8D1F\u8D23\u4ECA\u5929\u5B66\u4F1A\u3002"}</div></div></main>`;
  document.getElementById("listenBack").onclick = () => {
    touchActivity(listen.activityId);
    listen = null;
    view = "today";
    renderToday();
  };
  document.getElementById("speakWord").onclick = () => {
    speak(w.en);
    if (!reviewing) touchActivity(listen.activityId);
  };
  if (!reviewing) document.getElementById("retireWord").onclick = () => {
    w.retired = true;
    persist();
    finishCurrent(listen.session, "good");
    listen.currentEventId = null;
    listen.result = null;
    listen.answer = false;
    if (!pickNext(listen.session)) {
      listen = null;
      view = "today";
      renderToday();
    } else {
      renderListen();
      speak(listenCurrentWord().en);
    }
  };
  document.getElementById("judgeGood").onclick = () => judgeListen("good");
  document.getElementById("judgeBad").onclick = () => judgeListen("bad");
  if (answer) {
    document.getElementById("prevWord").onclick = () => showPreviousListen();
    document.getElementById("nextWord").onclick = () => reviewing ? returnFromHistory() : nextListen();
  }
}
function judgeListen(result) {
  const w = listenCurrentWord();
  if (listen.historyView) {
    editAttempt(state, listen.historyView.eventId, result);
    listen.historyView.result = result;
    persist();
    renderListen();
    return;
  }
  if (!listen.currentEventId) {
    const ev = recordAttempt(state, w, "listen", result);
    listen.currentEventId = ev.id;
    listen.session.current.eventId = ev.id;
  } else editAttempt(state, listen.currentEventId, result);
  listen.result = result;
  listen.answer = true;
  touchActivity(listen.activityId);
  persist();
  renderListen();
}
function nextListen() {
  if (!listen.result) return;
  finishCurrent(listen.session, listen.result);
  listen.currentEventId = null;
  listen.result = null;
  listen.answer = false;
  touchActivity(listen.activityId);
  const id = pickNext(listen.session);
  if (!id) {
    const p = sessionProgress(state, listen.plan, listen.session);
    root.innerHTML = `<main class="immersive"><div class="studybody"><div class="finish"><div class="small">\u672C\u8F6E\u5B8C\u6210</div><h2>\u4ECA\u65E5\u542C\u97F3\u5B8C\u6210</h2><div class="grid3" style="margin:18px 0"><div class="statbox"><b>${p.newDone}/${p.newTotal}</b><span>\u65B0\u8BCD</span></div><div class="statbox"><b>${p.reviewDone}/${p.reviewTotal}</b><span>\u590D\u4E60</span></div><div class="statbox"><b>${p.retry}</b><span>\u5F85\u5DE9\u56FA</span></div></div><button id="finishListen" class="primary">\u56DE\u5230\u4ECA\u65E5</button></div></div></main>`;
    document.getElementById("finishListen").onclick = () => {
      listen = null;
      view = "today";
      renderToday();
    };
    return;
  }
  renderListen();
  speak(wordById(id).en);
}
function showPreviousListen() {
  const h = listen.session.history[listen.session.history.length - 1];
  if (!h?.eventId) return;
  listen.historyView = { wordId: h.wordId, eventId: h.eventId, result: state.events.find((e) => e.id === h.eventId)?.result || h.result };
  renderListen();
}
function returnFromHistory() {
  const plan = ensureDailyPlan(state);
  const activityId = listen.activityId;
  listen = { plan, session: createRetrySession(state, plan, "listen"), currentEventId: null, result: null, answer: false, activityId, historyView: null };
  const id = pickNext(listen.session);
  if (!id) {
    listen = null;
    view = "today";
    renderToday();
  } else {
    renderListen();
    speak(wordById(id).en);
  }
}
function typeCandidates() {
  const books = state.settings.typeBooks || [];
  return state.words.filter((w) => !w.retired && matchesBooks(w, books));
}
function eventsSince(days) {
  const d = /* @__PURE__ */ new Date();
  d.setDate(d.getDate() - days + 1);
  const key = dayKey(d.getTime());
  return state.events.filter((e) => e.date >= key);
}
function typePreset(kind) {
  const candidates = typeCandidates();
  const allowed = new Set(candidates.map((w) => w.id));
  const today = dayKey();
  if (kind === "todayListen") return [...new Set(state.events.filter((e) => e.date === today && e.mode === "listen" && e.result === "bad" && allowed.has(e.wordId)).map((e) => e.wordId))];
  if (kind === "todayType") return [...new Set(state.events.filter((e) => e.date === today && e.mode === "type" && e.result === "bad" && allowed.has(e.wordId)).map((e) => e.wordId))];
  if (kind === "repeat7") {
    const bad = eventsSince(7).filter((e) => e.result === "bad" && allowed.has(e.wordId));
    return candidates.map((w) => ({ id: w.id, ev: bad.filter((e) => e.wordId === w.id) })).filter((x) => x.ev.length >= 2 || new Set(x.ev.map((e) => e.date)).size >= 2).sort((a, b) => b.ev.length - a.ev.length).map((x) => x.id);
  }
  const scored = candidates.map((w) => {
    const ev = state.events.filter((e) => e.wordId === w.id);
    const coldBad = ev.filter((e) => e.cold && e.result === "bad").length;
    const bad = ev.filter((e) => e.result === "bad").length;
    const recent = eventsSince(7).filter((e) => e.wordId === w.id && e.result === "bad").length;
    const r = retrievability(w.card, Date.now(), state.settings.retention);
    return { id: w.id, score: coldBad * 5 + bad + recent * 1.5 + (w.card?.reps ? (1 - r) * 2 : 0) };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
  return scored.map((x) => x.id);
}
function renderType() {
  const books = state.settings.typeBooks || [];
  const auto = typePreset("auto"), l = typePreset("todayListen"), t = typePreset("todayType"), r = typePreset("repeat7");
  const typedToday = new Set(state.events.filter((e) => e.date === dayKey() && e.mode === "type").map((e) => e.wordId)).size;
  shell(`<div class="stack"><section class="card hero"><div class="space"><div><h2>\u624B\u6253\u5F3A\u5316</h2><p>\u5148\u7ED9\u4F60\u6700\u503C\u5F97\u7EC3\u7684\u5165\u53E3\uFF1B\u65E5\u671F\u3001\u6B21\u6570\u7B49\u7CBE\u786E\u7B5B\u9009\u653E\u4E0B\u9762\u3002</p></div><span class="tag">${books.length ? `${books.length} \u672C\u8BCD\u4E66` : "\u5168\u90E8\u8BCD\u4E66"}</span></div><div class="grid3" style="margin-top:13px"><div class="statbox"><b>${auto.length}</b><span>\u5EFA\u8BAE\u5F3A\u5316</span></div><div class="statbox"><b>${typedToday}</b><span>\u4ECA\u65E5\u5DF2\u624B\u6253</span></div><div class="statbox"><b>${activityMinutes("type")}m</b><span>\u624B\u6253\u7528\u65F6</span></div></div><div class="row" style="margin-top:15px"><button id="typeStartAuto" class="primary">\u5F00\u59CB\u5EFA\u8BAE\u5F3A\u5316${auto.length ? ` \xB7 ${Math.min(30, auto.length)}` : ""}</button></div><details class="details"><summary>\u8BCD\u4E66\u8303\u56F4\u4E0E\u9AD8\u7EA7\u7B5B\u9009</summary><div style="margin-top:12px">${bookChips(books, "type")}<div class="filtergrid" style="margin-top:12px"><div class="field"><label>\u6307\u5B9A\u65E5\u671F</label><input id="typeDate" type="date" value="${dayKey()}"></div><div class="field"><label>\u5931\u8D25\u6765\u6E90</label><select id="typeMode"><option value="all">\u542C\u97F3 + \u624B\u6253</option><option value="listen">\u53EA\u770B\u542C\u97F3</option><option value="type">\u53EA\u770B\u624B\u6253</option></select></div><div class="field"><label>\u81F3\u5C11\u4E0D\u719F\u6B21\u6570</label><select id="typeMin"><option>1</option><option>2</option><option>3</option><option>5</option></select></div><div class="field"><label>\u672C\u8F6E\u6570\u91CF</label><select id="typeLimit"><option>20</option><option selected>50</option><option>100</option><option value="0">\u5168\u90E8</option></select></div></div><div id="customTypePreview" style="margin-top:12px"></div></div></details></section><section class="card"><h2 class="section-title">\u5FEB\u6377\u5165\u53E3</h2><div class="quick" style="margin-top:12px"><button data-type-preset="todayListen"><span class="num">${l.length}</span><b>\u4ECA\u65E5\u542C\u97F3\u4E0D\u719F</b><span class="small">\u4ECA\u5929\u542C\u97F3\u9636\u6BB5\u66B4\u9732\u51FA\u6765\u7684\u8BCD</span></button><button data-type-preset="todayType"><span class="num">${t.length}</span><b>\u4ECA\u65E5\u624B\u6253\u4E0D\u719F</b><span class="small">\u4ECA\u5929\u624B\u6253\u540E\u4ECD\u7136\u5361\u4F4F</span></button><button data-type-preset="repeat7"><span class="num">${r.length}</span><b>\u8FD1 7 \u5929\u53CD\u590D\u4E0D\u719F</b><span class="small">\u8FD1\u671F\u91CD\u590D\u5931\u8D25\u7684\u8BCD</span></button><button data-type-preset="auto"><span class="num">${auto.length}</span><b>\u5168\u90E8\u56F0\u96BE\u8BCD</b><span class="small">\u6309\u8DE8\u5929\u5931\u8D25\u4E0E\u53EF\u63D0\u53D6\u7387\u6392\u5E8F</span></button></div></section></div>`);
  bindBookChips("type", renderType);
  document.getElementById("typeStartAuto").onclick = () => startType(auto.slice(0, 30), "\u5EFA\u8BAE\u5F3A\u5316");
  document.querySelectorAll("[data-type-preset]").forEach((b) => b.onclick = () => startType(typePreset(b.dataset.typePreset).slice(0, 50), b.textContent.trim().replace(/\d+/, "").slice(0, 20)));
  const inputs = ["typeDate", "typeMode", "typeMin", "typeLimit"];
  inputs.forEach((id) => document.getElementById(id).onchange = renderTypeCustom);
  renderTypeCustom();
}
function customTypeIds() {
  const date = document.getElementById("typeDate")?.value || dayKey();
  const mode = document.getElementById("typeMode")?.value || "all";
  const min = Number(document.getElementById("typeMin")?.value || 1);
  const allowed = new Set(typeCandidates().map((w) => w.id));
  const groups = /* @__PURE__ */ new Map();
  for (const e of state.events) {
    if (e.date !== date || e.result !== "bad" || !allowed.has(e.wordId) || mode !== "all" && e.mode !== mode) continue;
    groups.set(e.wordId, (groups.get(e.wordId) || 0) + 1);
  }
  return [...groups.entries()].filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
function renderTypeCustom() {
  const box = document.getElementById("customTypePreview");
  if (!box) return;
  const ids = customTypeIds();
  const limit = Number(document.getElementById("typeLimit")?.value || 50);
  const q = limit ? ids.slice(0, limit) : ids;
  box.innerHTML = `<div class="space"><div><b>${ids.length} \u4E2A\u8BCD\u5339\u914D</b><div class="small">${q.slice(0, 8).map((id) => esc(wordById(id)?.en)).join(" \xB7 ")}</div></div><button id="startCustomType" class="soft" ${q.length ? "" : "disabled"}>\u5F00\u59CB\u8FD9\u7EC4${q.length ? ` \xB7 ${q.length}` : ""}</button></div>`;
  document.getElementById("startCustomType").onclick = () => startType(q, "\u81EA\u5B9A\u4E49\u5F3A\u5316");
}
function startType(ids, label) {
  ids = [...new Set(ids)].filter((id2) => wordById(id2) && !wordById(id2).retired);
  if (!ids.length) return toast("\u8FD9\u7EC4\u6682\u65F6\u6CA1\u6709\u5F85\u5F3A\u5316\u8BCD");
  const fakePlan = { date: dayKey(), newIds: ids, reviewIds: [] };
  const session = createRetrySession(state, fakePlan, "type", ids);
  const id = pickNext(session);
  if (!id) return toast("\u8FD9\u4E9B\u8BCD\u4ECA\u5929\u5DF2\u7ECF\u624B\u6253\u719F\u6089\u4E86");
  typeRun = { ids, label, session, answer: false, input: "", currentEventId: null, result: null, skipped: 0, activityId: startActivity("type", label, state.settings.typeBooks || []) };
  renderTypeRun();
  speak(wordById(id).en);
}
function typeProgress() {
  const done = typeRun.ids.filter((id) => latestEventOnDay(state, id, dayKey(), "type")?.result === "good").length;
  const bad = typeRun.ids.filter((id) => latestEventOnDay(state, id, dayKey(), "type")?.result === "bad").length;
  return { done, total: typeRun.ids.length, bad };
}
function renderTypeRun() {
  const id = typeRun.session.current?.wordId;
  const w = wordById(id);
  if (!w) return finishType();
  const p = typeProgress();
  root.innerHTML = `<main class="immersive"><div class="studytop"><button id="typeBack" class="back">\u2039</button><div class="studyprogress">${p.done} / ${p.total}${p.bad ? `\u3000\u5F85\u5DE9\u56FA ${p.bad}` : ""} \xB7 ${esc(typeRun.label)}</div></div><div class="studybody"><button id="typeSpeak" class="speaker">\u25D6))</button>${!typeRun.answer ? `<div class="small">\u542C\u97F3\u540E\u5199\u51FA\u4F60\u76F4\u63A5\u60F3\u5230\u7684\u4E2D\u6587\u6838\u5FC3\u610F\u601D\u3002</div><div style="width:100%;max-width:560px;margin-top:18px"><input id="typeAnswer" style="font-size:21px;text-align:center" placeholder="\u5199\u4E2D\u6587\u6838\u5FC3\u610F\u601D\u2026" autocomplete="off"><div class="grid2" style="margin-top:10px"><button id="typeSubmit" class="primary">\u63D0\u4EA4</button><button id="typeReveal" class="soft">\u770B\u7B54\u6848</button></div></div>` : `<div class="word ${typeRun.result === "good" ? "good" : typeRun.result === "bad" ? "bad" : ""}">${esc(w.en)}</div><div class="meaning">${esc(w.zh || "\u6682\u65E0\u4E2D\u6587\u91CA\u4E49")}</div>${w.pos || w.def ? `<div class="meta">${esc(w.pos)}${w.def ? ` \xB7 ${esc(w.def)}` : ""}</div>` : ""}${w.examples?.length ? `<div class="example">${esc(w.examples[w.examples.length - 1])}</div>` : ""}<div class="source-tags">${(w.sources || []).map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div><div class="typed"><b>\u4F60\u521A\u624D\u5199\u7684\u662F</b><div>${esc(typeRun.input || "\uFF08\u76F4\u63A5\u770B\u4E86\u7B54\u6848\uFF09")}</div></div><div class="judges"><button id="typeGood" class="goodbtn">1\u3000\u719F\u6089</button><button id="typeBad" class="badbtn">2\u3000\u4E0D\u719F\u6089</button></div><div class="move"><button id="typeReplay" class="soft">\u91CD\u542C</button><button id="typeNext" class="primary" ${typeRun.result ? "" : "disabled"}>\u4E0B\u4E00\u8BCD</button></div><div class="statusline">\u4E0D\u81EA\u52A8\u5224\u4E2D\u6587\u540C\u4E49\u8BCD\u5BF9\u9519\uFF1B\u719F\u6089/\u4E0D\u719F\u6089\u4ECD\u7136\u4F5C\u7528\u4E8E\u540C\u4E00\u4E2A\u5355\u8BCD\u5386\u53F2\u3002</div>`}</div></main>`;
  document.getElementById("typeBack").onclick = () => {
    touchActivity(typeRun.activityId);
    typeRun = null;
    view = "type";
    renderType();
  };
  document.getElementById("typeSpeak").onclick = () => {
    speak(w.en);
    touchActivity(typeRun.activityId);
  };
  if (!typeRun.answer) {
    const input = document.getElementById("typeAnswer");
    input.value = typeRun.input;
    input.focus();
    const reveal = (skip) => {
      typeRun.input = input.value.trim();
      if (skip || !typeRun.input) typeRun.skipped++;
      typeRun.answer = true;
      renderTypeRun();
    };
    document.getElementById("typeSubmit").onclick = () => typeRun.input || input.value.trim() ? reveal(false) : toast("\u6CA1\u5199\u5185\u5BB9\u7684\u8BDD\u70B9\u300C\u770B\u7B54\u6848\u300D");
    document.getElementById("typeReveal").onclick = () => reveal(true);
    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        reveal(!input.value.trim());
      }
    };
  } else {
    document.getElementById("typeGood").onclick = () => judgeType("good");
    document.getElementById("typeBad").onclick = () => judgeType("bad");
    document.getElementById("typeReplay").onclick = () => speak(w.en);
    document.getElementById("typeNext").onclick = nextType;
  }
}
function judgeType(result) {
  const w = wordById(typeRun.session.current.wordId);
  if (!typeRun.currentEventId) {
    const ev = recordAttempt(state, w, "type", result);
    typeRun.currentEventId = ev.id;
    typeRun.session.current.eventId = ev.id;
  } else editAttempt(state, typeRun.currentEventId, result);
  typeRun.result = result;
  touchActivity(typeRun.activityId);
  persist();
  renderTypeRun();
}
function nextType() {
  if (!typeRun.result) return;
  finishCurrent(typeRun.session, typeRun.result);
  typeRun.answer = false;
  typeRun.input = "";
  typeRun.currentEventId = null;
  typeRun.result = null;
  touchActivity(typeRun.activityId);
  if (!pickNext(typeRun.session)) finishType();
  else {
    renderTypeRun();
    speak(wordById(typeRun.session.current.wordId).en);
  }
}
function finishType() {
  const p = typeProgress();
  const bad = typeRun.ids.filter((id) => latestEventOnDay(state, id, dayKey(), "type")?.result === "bad");
  root.innerHTML = `<main class="immersive"><div class="studybody"><div class="finish"><div class="small">\u672C\u8F6E\u5B8C\u6210</div><h2>${esc(typeRun.label)}</h2><div class="grid3" style="margin:18px 0"><div class="statbox"><b>${p.total}</b><span>\u672C\u8F6E\u8BCD\u6570</span></div><div class="statbox"><b class="good">${p.done}</b><span>\u6700\u7EC8\u719F\u6089</span></div><div class="statbox"><b class="bad">${bad.length}</b><span>\u4ECD\u4E0D\u719F</span></div></div><div class="small">\u76F4\u63A5\u770B\u7B54\u6848 ${typeRun.skipped} \u6B21</div><div class="row" style="justify-content:center;margin-top:18px">${bad.length ? `<button id="redoType" class="primary">\u518D\u7EC3\u4E0D\u719F \xB7 ${bad.length}</button>` : ""}<button id="finishType" class="soft">\u8FD4\u56DE\u624B\u6253</button></div></div></div></main>`;
  const copy = [...bad];
  if (document.getElementById("redoType")) document.getElementById("redoType").onclick = () => {
    const label = "\u672C\u8F6E\u4E0D\u719F\u518D\u7EC3";
    typeRun = null;
    startType(copy, label);
  };
  document.getElementById("finishType").onclick = () => {
    typeRun = null;
    view = "type";
    renderType();
  };
}
function splitSentences(body) {
  return (String(body || "").replace(/\r/g, "").match(/[^.!?。！？\n]+[.!?。！？]+|[^.!?。！？\n]+(?=\n|$)/g) || []).map((x) => x.trim()).filter(Boolean);
}
function renderText() {
  if (textReaderId) return renderTextReader();
  const cols = [...new Set(state.texts.map((t) => t.collection || "\u672A\u5206\u7C7B"))].sort();
  const editing = textEditId ? state.texts.find((t) => t.id === textEditId) : null;
  shell(`<div class="stack"><section class="card hero"><div class="space"><div><h2>\u6587\u672C\u5E93</h2><p>\u4FDD\u5B58 transcript \u548C\u6587\u7AE0\uFF0C\u4E4B\u540E\u76F4\u63A5\u7EE7\u7EED\u542C\uFF0C\u4E0D\u7528\u91CD\u65B0\u7C98\u8D34\u3002</p></div><button id="newText" class="primary">${textFormOpen || editing ? "\u6536\u8D77" : "\u65B0\u5EFA\u6587\u672C"}</button></div><div class="grid3" style="margin-top:13px"><div class="statbox"><b>${state.texts.length}</b><span>\u7BC7\u6587\u672C</span></div><div class="statbox"><b>${cols.length}</b><span>\u4E2A\u6587\u672C\u5E93</span></div><div class="statbox"><b>${state.texts.reduce((n, t) => n + (t.body.match(/[A-Za-z]+/g)?.length || 0), 0)}</b><span>\u82F1\u6587\u8BCD\u91CF</span></div></div></section>${textFormOpen || editing ? `<section class="card"><h2 class="section-title">${editing ? "\u7F16\u8F91\u6587\u672C" : "\u65B0\u5EFA\u6587\u672C"}</h2><div class="grid2" style="margin-top:12px"><div class="field"><label>\u6807\u9898</label><input id="textTitle" value="${esc(editing?.title || "")}" placeholder="Test 3 Part 4"></div><div class="field"><label>\u6240\u5C5E\u6587\u672C\u5E93</label><input id="textCollection" value="${esc(editing?.collection || "")}" placeholder="\u525118"></div></div><textarea id="textBody" style="margin-top:10px" placeholder="\u7C98\u8D34 transcript / \u6587\u7AE0\u6B63\u6587\u2026">${esc(editing?.body || "")}</textarea><div class="row" style="margin-top:10px"><button id="saveText" class="primary">\u4FDD\u5B58</button><button id="importTextFile" class="soft">\u5BFC\u5165 TXT</button></div></section>` : ""}<section class="card"><div class="space"><div><h2 class="section-title">\u6211\u7684\u6587\u672C</h2><div class="small">\u6309\u5E93\u7B5B\u9009\u6216\u641C\u7D22\u6807\u9898/\u6B63\u6587\u3002</div></div></div><div class="grid2" style="margin-top:12px"><input id="textSearch" placeholder="\u641C\u7D22\u6587\u672C"><select id="textFilter"><option value="">\u5168\u90E8\u6587\u672C\u5E93</option>${cols.map((c) => `<option>${esc(c)}</option>`).join("")}</select></div><div id="textList" class="list" style="margin-top:12px"></div></section></div>`);
  document.getElementById("newText").onclick = () => {
    textFormOpen = !textFormOpen;
    if (!textFormOpen) textEditId = null;
    renderText();
  };
  if (textFormOpen || editing) {
    document.getElementById("saveText").onclick = saveTextItem;
    document.getElementById("importTextFile").onclick = () => textInput.click();
  }
  document.getElementById("textSearch").oninput = drawTextList;
  document.getElementById("textFilter").onchange = drawTextList;
  drawTextList();
}
function drawTextList() {
  const box = document.getElementById("textList");
  if (!box) return;
  const q = document.getElementById("textSearch").value.trim().toLowerCase(), c = document.getElementById("textFilter").value;
  const list = [...state.texts].sort((a, b) => (b.lastOpened || b.updatedAt || 0) - (a.lastOpened || a.updatedAt || 0)).filter((t) => (!c || t.collection === c) && (!q || `${t.title} ${t.collection} ${t.body}`.toLowerCase().includes(q)));
  box.innerHTML = list.length ? list.map((t) => `<article class="textitem"><div class="space"><div><h3>${esc(t.title)}</h3><div class="small"><span class="tag">${esc(t.collection || "\u672A\u5206\u7C7B")}</span> \xB7 ${splitSentences(t.body).length} \u53E5</div></div></div><p class="snippet">${esc(t.body.replace(/\s+/g, " "))}</p><div class="toolbar"><button class="primary" data-open-text="${t.id}">\u7EE7\u7EED\u542C${t.sentence ? ` \xB7 \u7B2C ${t.sentence + 1} \u53E5` : ""}</button><button class="soft" data-edit-text="${t.id}">\u7F16\u8F91</button><button class="danger" data-delete-text="${t.id}">\u5220\u9664</button></div></article>`).join("") : '<div class="empty">\u8FD8\u6CA1\u6709\u6587\u672C\u3002</div>';
  document.querySelectorAll("[data-open-text]").forEach((b) => b.onclick = () => {
    textReaderId = b.dataset.openText;
    const t = state.texts.find((x) => x.id === textReaderId);
    t.lastOpened = Date.now();
    persist();
    renderTextReader();
  });
  document.querySelectorAll("[data-edit-text]").forEach((b) => b.onclick = () => {
    textEditId = b.dataset.editText;
    textFormOpen = true;
    renderText();
  });
  document.querySelectorAll("[data-delete-text]").forEach((b) => b.onclick = () => {
    const t = state.texts.find((x) => x.id === b.dataset.deleteText);
    if (confirm(`\u5220\u9664\u300C${t.title}\u300D\uFF1F\u5DF2\u52A0\u5165\u8BCD\u5E93\u7684\u5355\u8BCD\u4E0D\u4F1A\u5220\u9664\u3002`)) {
      state.texts = state.texts.filter((x) => x.id !== t.id);
      persist();
      renderText();
    }
  });
}
function saveTextItem() {
  const title = document.getElementById("textTitle").value.trim(), collection = document.getElementById("textCollection").value.trim() || "\u672A\u5206\u7C7B", body = document.getElementById("textBody").value.trim();
  if (!title || !body) return toast("\u6807\u9898\u548C\u6B63\u6587\u90FD\u8981\u586B");
  const now = Date.now();
  if (textEditId) {
    const t = state.texts.find((x) => x.id === textEditId);
    Object.assign(t, { title, collection, body, updatedAt: now });
    t.sentence = Math.min(t.sentence || 0, Math.max(0, splitSentences(body).length - 1));
  } else state.texts.unshift({ id: uid("text"), title, collection, body, createdAt: now, updatedAt: now, lastOpened: 0, sentence: 0, hidden: false, loop: false });
  textEditId = null;
  textFormOpen = false;
  persist();
  renderText();
}
function renderTextReader() {
  const t = state.texts.find((x) => x.id === textReaderId);
  if (!t) {
    textReaderId = null;
    return renderText();
  }
  const ss = splitSentences(t.body);
  if (!ss.length) ss.push(t.body);
  t.sentence = Math.max(0, Math.min(ss.length - 1, t.sentence || 0));
  const sentence = ss[t.sentence], source = `${t.collection || "\u672A\u5206\u7C7B"} \xB7 ${t.title}`;
  root.innerHTML = `<main class="immersive"><div class="studytop"><button id="textBack" class="back">\u2039</button><div class="studyprogress">${esc(t.title)}<br><span class="small">${esc(t.collection || "\u672A\u5206\u7C7B")}</span></div><button id="textEdit" class="retire">\u7F16\u8F91</button></div><div class="reader"><div class="reader-actions"><button id="playFull" class="soft">\u5168\u6587\u6717\u8BFB</button><button id="toggleText" class="soft">${t.hidden ? "\u663E\u793A\u539F\u6587" : "\u9690\u85CF\u539F\u6587"}</button><button id="toggleLoop" class="soft">\u5355\u53E5\u5FAA\u73AF ${t.loop ? "\u5F00" : "\u5173"}</button></div><div class="sentence ${t.hidden ? "blur" : ""}">${esc(sentence)}</div><div class="sentence-nav"><button id="prevSentence" class="soft" ${t.sentence === 0 ? "disabled" : ""}>\u4E0A\u4E00\u53E5</button><button id="playSentence" class="primary">\u91CD\u542C\u672C\u53E5</button><button id="nextSentence" class="soft" ${t.sentence === ss.length - 1 ? "disabled" : ""}>\u4E0B\u4E00\u53E5</button></div><section class="card" style="margin-top:14px"><h3 style="margin-top:0">\u5168\u6587</h3><div id="fullText" class="fulltext ${t.hidden ? "blur" : ""}">${esc(t.body)}</div></section><section class="card" style="margin-top:14px"><h3 style="margin-top:0">\u4ECE\u672C\u6587\u52A0\u5165\u5355\u8BCD</h3><div class="small">\u6765\u6E90\u4F1A\u4FDD\u5B58\u4E3A\u300C${esc(source)}\u300D\uFF0C\u4F8B\u53E5\u9ED8\u8BA4\u4FDD\u5B58\u5F53\u524D\u53E5\u3002</div><div class="grid2" style="margin-top:10px"><input id="textWord" placeholder="\u82F1\u6587\u5355\u8BCD"><input id="textZh" placeholder="\u4E2D\u6587\u6838\u5FC3\u4E49\uFF0C\u53EF\u7559\u7A7A"></div><div class="row" style="margin-top:10px"><button id="useSelection" class="soft">\u4F7F\u7528\u9009\u4E2D\u7684\u8BCD</button><button id="addFromText" class="primary">\u52A0\u5165\u8BCD\u5E93</button></div></section></div></main>`;
  document.getElementById("textBack").onclick = () => {
    speechSynthesis.cancel();
    textReaderId = null;
    view = "text";
    renderText();
  };
  document.getElementById("textEdit").onclick = () => {
    speechSynthesis.cancel();
    textEditId = t.id;
    textFormOpen = true;
    textReaderId = null;
    renderText();
  };
  document.getElementById("playFull").onclick = () => speak(t.body);
  document.getElementById("playSentence").onclick = () => speakSentence(t, sentence);
  document.getElementById("prevSentence").onclick = () => {
    t.sentence--;
    persist();
    renderTextReader();
    speak(ss[t.sentence]);
  };
  document.getElementById("nextSentence").onclick = () => {
    t.sentence++;
    persist();
    renderTextReader();
    speak(ss[t.sentence]);
  };
  document.getElementById("toggleText").onclick = () => {
    t.hidden = !t.hidden;
    persist();
    renderTextReader();
  };
  document.getElementById("toggleLoop").onclick = () => {
    t.loop = !t.loop;
    persist();
    renderTextReader();
    if (t.loop) speakSentence(t, sentence);
    else speechSynthesis.cancel();
  };
  document.getElementById("useSelection").onclick = () => {
    const x = String(window.getSelection?.().toString() || "").trim().replace(/^[^A-Za-z'’-]+|[^A-Za-z'’-]+$/g, "");
    if (!x || /\s/.test(x)) return toast("\u5148\u53EA\u9009\u4E2D\u4E00\u4E2A\u82F1\u6587\u5355\u8BCD");
    document.getElementById("textWord").value = x;
  };
  document.getElementById("addFromText").onclick = () => addWordFromText(source, sentence);
  persist();
}
function speakSentence(t, sentence) {
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(sentence);
  u.lang = "en-US";
  u.rate = Number(state.settings.speechRate) || 0.92;
  u.onend = () => {
    if (t.loop && textReaderId === t.id) setTimeout(() => speakSentence(t, sentence), 180);
  };
  speechSynthesis.speak(u);
}
function addWordFromText(source, sentence) {
  const en = document.getElementById("textWord").value.trim().toLowerCase(), zh = document.getElementById("textZh").value.trim();
  if (!en || /\s/.test(en)) return toast("\u8BF7\u8F93\u5165\u4E00\u4E2A\u82F1\u6587\u5355\u8BCD");
  upsertWord({ en, zh, source, example: sentence });
  persist();
  document.getElementById("textWord").value = "";
  document.getElementById("textZh").value = "";
  toast(`\u5DF2\u52A0\u5165 ${en}`);
}
function upsertWord({ en, zh = "", pos = "", def = "", source = "", example = "" }) {
  en = String(en || "").trim().toLowerCase();
  if (!en) return null;
  let w = state.words.find((x) => x.en === en);
  if (!w) {
    w = { id: uid("w"), en, zh, pos, def, sources: [], examples: [], retired: false, card: null };
    state.words.push(w);
  }
  if (zh && !w.zh) w.zh = zh;
  if (pos && !w.pos) w.pos = pos;
  if (def && !w.def) w.def = def;
  if (source && !w.sources.includes(source)) w.sources.push(source);
  if (example && !w.examples.includes(example)) w.examples.push(example);
  return w;
}
function renderLibrary() {
  const books = allBooks(state);
  shell(`<div class="stack"><section class="card hero"><div class="space"><div><h2>\u8BCD\u5E93</h2><p>\u5355\u8BCD\u53EA\u4FDD\u5B58\u4E00\u4EFD\uFF1B\u4E00\u672C\u8BCD\u53EF\u4EE5\u540C\u65F6\u5C5E\u4E8E\u591A\u4E2A\u8BCD\u4E66\u3002</p></div><span class="tag">${state.words.length} \u8BCD</span></div><div class="toolbar" style="margin-top:14px"><button id="importWords" class="primary">\u5BFC\u5165 CSV / TXT</button><button id="backupWords" class="soft">\u5B8C\u6574\u5907\u4EFD</button><button id="restoreWords" class="soft">\u6062\u590D\u5907\u4EFD</button></div><details class="details"><summary>\u590D\u4E60\u4E0E\u6717\u8BFB\u8BBE\u7F6E</summary><div class="grid2" style="margin-top:12px"><div class="field"><label>FSRS \u671F\u671B\u8BB0\u5FC6\u4FDD\u6301\u7387</label><input id="retention" type="number" min="0.75" max="0.97" step="0.01" value="${state.settings.retention}"></div><div class="field"><label>\u6717\u8BFB\u8BED\u901F</label><input id="speechRate" type="number" min="0.5" max="1.5" step="0.05" value="${state.settings.speechRate}"></div></div><div class="small" style="margin-top:8px">\u8C03\u5EA6\u6838\u5FC3\uFF1A${FSRS_VERSION}\u3002\u4FEE\u6539\u4FDD\u6301\u7387\u4F1A\u6309\u5386\u53F2\u9996\u8F6E\u8BB0\u5F55\u91CD\u65B0\u8BA1\u7B97\u5361\u7247\u72B6\u6001\u3002</div></details></section><section class="card"><div class="grid2"><input id="wordSearch" placeholder="\u641C\u7D22\u5355\u8BCD\u6216\u91CA\u4E49"><select id="wordBook"><option value="">\u5168\u90E8\u8BCD\u4E66</option>${books.map((b) => `<option>${esc(b)}</option>`).join("")}</select></div><div id="wordList" class="list" style="margin-top:12px"></div></section></div>`);
  document.getElementById("importWords").onclick = () => importInput.click();
  document.getElementById("backupWords").onclick = backup;
  document.getElementById("restoreWords").onclick = () => restoreInput.click();
  document.getElementById("wordSearch").oninput = drawWordList;
  document.getElementById("wordBook").onchange = drawWordList;
  document.getElementById("retention").onchange = (e) => {
    state.settings.retention = Math.min(0.97, Math.max(0.75, Number(e.target.value) || 0.9));
    rebuildAllCards(state);
    persist();
    toast("\u5DF2\u6309\u5386\u53F2\u8BB0\u5F55\u91CD\u65B0\u8BA1\u7B97 FSRS");
    renderLibrary();
  };
  document.getElementById("speechRate").onchange = (e) => {
    state.settings.speechRate = Math.min(1.5, Math.max(0.5, Number(e.target.value) || 0.92));
    persist();
  };
  drawWordList();
}
function drawWordList() {
  const box = document.getElementById("wordList");
  if (!box) return;
  const q = document.getElementById("wordSearch").value.trim().toLowerCase(), book = document.getElementById("wordBook").value;
  const list = state.words.filter((w) => (!book || w.sources.includes(book)) && (!q || `${w.en} ${w.zh}`.toLowerCase().includes(q))).slice(0, 200);
  box.innerHTML = list.length ? list.map((w) => `<div class="listitem"><div class="space"><div><h3>${esc(w.en)} ${w.retired ? '<span class="tag">\u5DF2\u9000\u51FA\u5FAA\u73AF</span>' : ""}</h3><div>${esc(w.zh || "")}</div><div class="source-tags" style="justify-content:flex-start">${w.sources.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div></div><button class="soft" data-retire="${w.id}">${w.retired ? "\u6062\u590D" : "\u9000\u51FA\u5FAA\u73AF"}</button></div></div>`).join("") : '<div class="empty">\u6CA1\u6709\u5339\u914D\u7684\u8BCD\u3002</div>';
  document.querySelectorAll("[data-retire]").forEach((b) => b.onclick = () => {
    const w = wordById(b.dataset.retire);
    w.retired = !w.retired;
    persist();
    drawWordList();
  });
}
function parseWordFile(text, name) {
  const lines = String(text).replace(/^\uFEFF/, "").split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  const source = name.replace(/\.(csv|txt|tsv)$/i, "") || "\u5BFC\u5165\u8BCD\u5E93";
  let count = 0;
  for (let i = 0; i < lines.length; i++) {
    const sep = lines[i].includes("	") ? "	" : ",";
    const parts = lines[i].split(sep).map((x) => x.trim().replace(/^"|"$/g, ""));
    if (i === 0 && /^(en|english|word|单词)$/i.test(parts[0])) continue;
    const [en, zh, pos, def] = parts;
    if (!en) continue;
    upsertWord({ en, zh, pos, def, source });
    count++;
  }
  persist();
  toast(`\u5DF2\u5BFC\u5165 ${count} \u884C`);
  renderLibrary();
}
function backup() {
  download(`listenwrite-backup-${dayKey()}.json`, exportState(state));
}
function filteredEvents() {
  if (!statRange) return state.events;
  const d = /* @__PURE__ */ new Date();
  d.setDate(d.getDate() - statRange + 1);
  const key = dayKey(d.getTime());
  return state.events.filter((e) => e.date >= key);
}
function renderStats() {
  const E = filteredEvents(), cold = E.filter((e) => e.cold), good = cold.filter((e) => e.result === "good").length, listenCold = cold.filter((e) => e.mode === "listen"), typeCold = cold.filter((e) => e.mode === "type"), uniq = new Set(E.map((e) => e.wordId)).size, forecast = dueForecast(state, 7);
  shell(`<div class="stack"><section><div class="toolbar"><button class="chip ${statRange === 7 ? "on" : ""}" data-range="7">7\u5929</button><button class="chip ${statRange === 30 ? "on" : ""}" data-range="30">30\u5929</button><button class="chip ${statRange === 0 ? "on" : ""}" data-range="0">\u5168\u90E8</button></div></section><section class="grid4"><div class="statbox"><b>${pct(good, cold.length)}</b><span>\u9996\u8F6E\u719F\u6089\u7387</span></div><div class="statbox"><b>${uniq}</b><span>\u533A\u95F4\u5B66\u4E60\u8BCD\u6570</span></div><div class="statbox"><b>${pct(listenCold.filter((e) => e.result === "good").length, listenCold.length)}</b><span>\u542C\u97F3\u9996\u8F6E</span></div><div class="statbox"><b>${pct(typeCold.filter((e) => e.result === "good").length, typeCold.length)}</b><span>\u624B\u6253\u9996\u8F6E</span></div></section>${calendarHtml()}${dayDetailHtml()}<section class="card"><h2 class="section-title">\u672A\u6765 7 \u5929\u590D\u4E60\u91CF</h2><div class="forecast">${forecast.map((x, i) => {
    const max = Math.max(1, ...forecast.map((y) => y.count));
    return `<div class="forecastrow"><span>${i === 0 ? "\u4ECA\u5929" : i === 1 ? "\u660E\u5929" : x.date.slice(5)}</span><div class="bar"><i style="width:${x.count * 100 / max}%"></i></div><b>${x.count}</b></div>`;
  }).join("")}</div></section>${hardWordsHtml(E)}</div>`);
  document.querySelectorAll("[data-range]").forEach((b) => b.onclick = () => {
    statRange = Number(b.dataset.range);
    renderStats();
  });
  bindCalendar();
  bindStatsActions();
}
function calendarHtml() {
  const activity = {};
  state.events.forEach((e) => activity[e.date] = (activity[e.date] || 0) + 1);
  const first = new Date(statMonth.getFullYear(), statMonth.getMonth(), 1), last = new Date(statMonth.getFullYear(), statMonth.getMonth() + 1, 0), offset = (first.getDay() + 6) % 7, start = new Date(first);
  start.setDate(first.getDate() - offset);
  const tail = 6 - (last.getDay() + 6) % 7, end = new Date(last);
  end.setDate(last.getDate() + tail);
  const cells = [];
  let max = 1;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = dayKey(d.getTime()), n = activity[key] || 0;
    max = Math.max(max, n);
    cells.push({ key, n, date: new Date(d), same: d.getMonth() === first.getMonth() });
  }
  return `<section class="card"><div class="space"><div><h2 class="section-title">\u5B66\u4E60\u65E5\u5386</h2><div class="small">\u53EF\u4EE5\u4E00\u76F4\u5F80\u524D\u7FFB\uFF0C\u70B9\u65E5\u671F\u770B\u5177\u4F53\u8BB0\u5F55\u3002</div></div></div><div class="calendarbar"><button id="calPrev">\u2039</button><div><b>${first.getFullYear()} \u5E74 ${first.getMonth() + 1} \u6708</b></div><button id="calNext">\u203A</button></div><div class="week"><span>\u4E00</span><span>\u4E8C</span><span>\u4E09</span><span>\u56DB</span><span>\u4E94</span><span>\u516D</span><span>\u65E5</span></div><div class="calgrid">${cells.map((c) => {
    const future = c.key > dayKey(), op = c.n ? 0.14 + 0.62 * c.n / max : 0.04;
    return `<button class="day ${c.key === statDay ? "sel " : ""}${c.same ? "" : "other "}${future ? "future" : ""}" data-stat-day="${c.key}" ${future ? "disabled" : ""} style="background:rgba(93,119,99,${op.toFixed(2)})"><span>${c.date.getDate()}</span>${c.n ? `<strong>${c.n}</strong>` : ""}</button>`;
  }).join("")}</div><div style="text-align:center;margin-top:8px"><button id="calToday" class="ghost">\u56DE\u5230\u672C\u6708</button></div></section>`;
}
function bindCalendar() {
  document.getElementById("calPrev").onclick = () => {
    statMonth = new Date(statMonth.getFullYear(), statMonth.getMonth() - 1, 1);
    renderStats();
  };
  document.getElementById("calNext").onclick = () => {
    const n = new Date(statMonth.getFullYear(), statMonth.getMonth() + 1, 1), now = /* @__PURE__ */ new Date(), cur = new Date(now.getFullYear(), now.getMonth(), 1);
    if (n <= cur) {
      statMonth = n;
      renderStats();
    }
  };
  document.getElementById("calToday").onclick = () => {
    const n = /* @__PURE__ */ new Date();
    statMonth = new Date(n.getFullYear(), n.getMonth(), 1);
    statDay = dayKey();
    renderStats();
  };
  document.querySelectorAll("[data-stat-day]").forEach((b) => b.onclick = () => {
    statDay = b.dataset.statDay;
    const d = dateObj(statDay);
    statMonth = new Date(d.getFullYear(), d.getMonth(), 1);
    renderStats();
  });
}
function dayDetailHtml() {
  const ev = state.events.filter((e) => e.date === statDay).sort((a, b) => a.ts - b.ts), ids = [...new Set(ev.map((e) => e.wordId))];
  const rows = ids.map((id) => {
    const w = wordById(id), a = ev.filter((e) => e.wordId === id), first = a.find((e) => e.cold) || a[0], bad = a.filter((e) => e.result === "bad").length, l = a.filter((e) => e.mode === "listen").length, t = a.filter((e) => e.mode === "type").length;
    return { w, a, first, bad, l, t };
  }).filter((x) => x.w).sort((a, b) => b.bad - a.bad || a.w.en.localeCompare(b.w.en));
  const cold = ev.filter((e) => e.cold), good = cold.filter((e) => e.result === "good").length;
  return `<section class="card"><div class="space"><div><h2 class="section-title">${statDay} \u8BE6\u60C5</h2><div class="small">\u9996\u8F6E\u719F\u6089 ${pct(good, cold.length)} \xB7 ${rows.length} \u4E2A\u8BCD \xB7 ${ev.length} \u6B21\u5224\u65AD</div></div>${rows.some((x) => x.bad) ? '<button id="practiceDayBad" class="soft">\u624B\u6253\u5F53\u5929\u4E0D\u719F</button>' : ""}</div><div style="margin-top:10px">${rows.length ? rows.map((x) => `<div class="bookrow"><b>${esc(x.w.en)}</b><span class="${x.first?.result === "good" ? "good" : "bad"}">\u9996\u8F6E${x.first?.result === "good" ? "\u719F\u6089" : "\u4E0D\u719F"}</span><span>\u4E0D\u719F ${x.bad}</span><span class="mobilehide">\u542C ${x.l}</span><span class="mobilehide">\u5199 ${x.t}</span></div>`).join("") : '<div class="empty">\u8FD9\u4E00\u5929\u6CA1\u6709\u8BB0\u5F55\u3002</div>'}</div></section>`;
}
function hardWordsHtml(E) {
  const map = /* @__PURE__ */ new Map();
  for (const e of E) {
    if (!map.has(e.wordId)) map.set(e.wordId, { coldBad: 0, bad: 0, events: [] });
    const g = map.get(e.wordId);
    g.events.push(e);
    if (e.result === "bad") {
      g.bad++;
      if (e.cold) g.coldBad++;
    }
  }
  const hard = [...map.entries()].map(([id, g]) => {
    const w = wordById(id);
    if (!w) return null;
    const r = retrievability(w.card, Date.now(), state.settings.retention);
    return { w, g, score: g.coldBad * 5 + g.bad + (w.card?.reps ? (1 - r) * 2 : 0) };
  }).filter((x) => x && x.g.bad).sort((a, b) => b.score - a.score).slice(0, 12);
  return `<section class="card"><div class="space"><div><h2 class="section-title">\u56F0\u96BE\u8BCD</h2><div class="small">\u8DE8\u5929\u9996\u8F6E\u5931\u8D25\u6743\u91CD\u6700\u9AD8\uFF0C\u518D\u53C2\u8003\u91CD\u590D\u5931\u8D25\u548C\u53EF\u63D0\u53D6\u7387\u3002</div></div>${hard.length ? '<button id="practiceHard" class="soft">\u624B\u6253\u8FD9\u6279</button>' : ""}</div>${hard.length ? hard.map((x) => `<div class="harditem"><div class="space"><div><div class="title">${esc(x.w.en)}</div><div class="small">\u9996\u8F6E\u4E0D\u719F ${x.g.coldBad} \xB7 \u603B\u4E0D\u719F ${x.g.bad} \xB7 FSRS\u53EF\u63D0\u53D6\u7387 ${Math.round(retrievability(x.w.card, Date.now(), state.settings.retention) * 100)}%</div></div><div>${esc(x.w.zh)}</div></div><div class="history">${x.g.events.slice(-8).map((e) => `<span class="pill ${e.result}">${e.date.slice(5)} ${e.mode === "type" ? "\u5199" : "\u542C"} ${e.result === "good" ? "\u719F" : "\u4E0D\u719F"}</span>`).join("")}</div></div>`).join("") : '<div class="empty">\u8FD9\u4E2A\u533A\u95F4\u6CA1\u6709\u4E0D\u719F\u8BB0\u5F55\u3002</div>'}</section>`;
}
function bindStatsActions() {
  const d = state.events.filter((e) => e.date === statDay && e.result === "bad").map((e) => e.wordId);
  if (document.getElementById("practiceDayBad")) document.getElementById("practiceDayBad").onclick = () => {
    view = "type";
    startType([...new Set(d)], `${statDay} \u4E0D\u719F\u8BCD`);
  };
  const E = filteredEvents(), scored = [...new Set(E.filter((e) => e.result === "bad").map((e) => e.wordId))].slice(0, 30);
  if (document.getElementById("practiceHard")) document.getElementById("practiceHard").onclick = () => {
    view = "type";
    startType(scored, "\u56F0\u96BE\u8BCD");
  };
}
function render() {
  try {
    if (listen) return renderListen();
    if (typeRun) return renderTypeRun();
    if (textReaderId) return renderTextReader();
    if (view === "home") renderHome();
    else if (view === "today") renderToday();
    else if (view === "type") renderType();
    else if (view === "text") renderText();
    else if (view === "library") renderLibrary();
    else renderStats();
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="app-error card"><h2>\u9875\u9762\u6E32\u67D3\u5931\u8D25</h2><p>\u6570\u636E\u6CA1\u6709\u88AB\u6E05\u7A7A\u3002\u5237\u65B0\u540E\u4ECD\u6709\u95EE\u9898\u53EF\u4EE5\u628A\u8FD9\u6BB5\u53D1\u7ED9\u6211\u3002</p><pre>${esc(err?.stack || err)}</pre></div>`;
  }
}
restoreInput.onchange = async () => {
  const f = restoreInput.files?.[0];
  if (!f) return;
  try {
    state = await replaceState(JSON.parse(await f.text()));
    toast("\u5907\u4EFD\u5DF2\u6062\u590D");
    view = "home";
    render();
  } catch {
    toast("\u5907\u4EFD\u6587\u4EF6\u65E0\u6CD5\u8BFB\u53D6");
  }
  restoreInput.value = "";
};
importInput.onchange = async () => {
  const f = importInput.files?.[0];
  if (!f) return;
  parseWordFile(await f.text(), f.name);
  importInput.value = "";
};
textInput.onchange = async () => {
  const f = textInput.files?.[0];
  if (!f) return;
  textFormOpen = true;
  renderText();
  document.getElementById("textTitle").value = f.name.replace(/\.txt$/i, "");
  document.getElementById("textBody").value = await f.text();
  textInput.value = "";
};
window.addEventListener("keydown", (e) => {
  if (listen) {
    if (e.key === "1") judgeListen("good");
    else if (e.key === "2") judgeListen("bad");
    else if (e.key === "Enter" && listen.answer) nextListen();
    else if ((e.key === "Backspace" || e.key === "ArrowLeft") && listen.answer) {
      e.preventDefault();
      showPreviousListen();
    }
  } else if (typeRun && typeRun.answer) {
    if (e.key === "1") judgeType("good");
    else if (e.key === "2") judgeType("bad");
    else if (e.key === "Enter" && typeRun.result) nextType();
  }
});
(async function init() {
  state = await loadState();
  render();
})();
/*! Bundled license information:

ts-fsrs/dist/index.mjs:
  (* istanbul ignore next -- @preserve *)

ts-fsrs/dist/index.mjs:
  (* istanbul ignore next -- @preserve *)

ts-fsrs/dist/index.mjs:
  (* istanbul ignore next -- @preserve *)
*/
