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
    // Cards can be rebuilt from the event log. Fuzz would make the same history
    // produce a different due date after a reload/import, so keep it disabled.
    enable_fuzz: false,
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
  const cold = [...events].filter((event) => event.cold && event.mode === "listen" && (event.result === "good" || event.result === "bad")).sort((a, b) => a.ts - b.ts);
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

// src/studyday.js
var STUDY_UTC_OFFSET_HOURS = 8;
var STUDY_DAY_GRACE_END_HOUR = 2;
var OFFSET_MS = STUDY_UTC_OFFSET_HOURS * 36e5;
function pad2(n) {
  return String(n).padStart(2, "0");
}
function calendarDayKey(ts = Date.now()) {
  const local = new Date(Number(ts) + OFFSET_MS);
  return `${local.getUTCFullYear()}-${pad2(local.getUTCMonth() + 1)}-${pad2(local.getUTCDate())}`;
}
function shanghaiClock(ts = Date.now()) {
  const local = new Date(Number(ts) + OFFSET_MS);
  return {
    year: local.getUTCFullYear(),
    month: local.getUTCMonth() + 1,
    day: local.getUTCDate(),
    hour: local.getUTCHours(),
    minute: local.getUTCMinutes(),
    second: local.getUTCSeconds()
  };
}
function isGraceWindow(ts = Date.now()) {
  const { hour } = shanghaiClock(ts);
  return hour >= 0 && hour < STUDY_DAY_GRACE_END_HOUR;
}
function studyDayParts(key = calendarDayKey()) {
  const [year, month, day] = String(key).split("-").map(Number);
  return { year, month, day };
}
function formatDayKey(year, month, day) {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}
function addStudyDays(key, amount) {
  const { year, month, day } = studyDayParts(key);
  const d = new Date(Date.UTC(year, month - 1, day + Number(amount || 0), 12));
  return formatDayKey(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}
function studyDayStart(key = calendarDayKey()) {
  const { year, month, day } = studyDayParts(key);
  return Date.UTC(year, month - 1, day, -STUDY_UTC_OFFSET_HOURS, 0, 0, 0);
}
function studyDayEnd(key = calendarDayKey()) {
  return studyDayStart(addStudyDays(key, 1)) - 1;
}
function calendarDate(key = calendarDayKey()) {
  const { year, month, day } = studyDayParts(key);
  return new Date(Date.UTC(year, month - 1, day, 12));
}
function calendarKey(date) {
  return formatDayKey(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
}
function studyDayLabel() {
  return "\u4E1C\u516B\u533A \xB7 24:00 \u6B63\u5E38\u6362\u65E5\uFF1B\u672A\u5B8C\u6210\u53EF\u5EF6\u7EED\u5230 02:00";
}

// src/sentencebooks.js
var VALID_STATUS = /* @__PURE__ */ new Set(["familiar", "unfamiliar", "unknown"]);
var VALID_PRACTICE_STATUS = /* @__PURE__ */ new Set(["unseen", "repeat", "done", "ignored"]);
function id(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
function normalizeLexeme(value) {
  return String(value || "").trim().toLowerCase();
}
function ensureSimpleWords(state2) {
  if (!Array.isArray(state2.simpleWords)) state2.simpleWords = [];
  const set = new Set(state2.simpleWords.map(normalizeLexeme).filter(Boolean));
  for (const word of state2.words || []) {
    if (word?.retired && word.en) set.add(normalizeLexeme(word.en));
  }
  state2.simpleWords = [...set];
  return state2.simpleWords;
}
function isSimpleLexeme(state2, value) {
  const lexeme = normalizeLexeme(value);
  if (!lexeme) return false;
  if (ensureSimpleWords(state2).includes(lexeme)) return true;
  return Boolean((state2.words || []).find((word) => normalizeLexeme(word.en) === lexeme)?.retired);
}
function markSimpleLexeme(state2, value, simple = true) {
  const lexeme = normalizeLexeme(value);
  if (!lexeme) return false;
  const set = new Set(ensureSimpleWords(state2));
  if (simple) set.add(lexeme);
  else set.delete(lexeme);
  state2.simpleWords = [...set];
  for (const word of state2.words || []) {
    if (normalizeLexeme(word.en) === lexeme) word.retired = simple;
  }
  return simple;
}
function ensureSentenceBooks(state2) {
  if (!Array.isArray(state2.sentenceBooks)) state2.sentenceBooks = [];
  return state2.sentenceBooks;
}
function ensureSentenceBook(state2, name = "\u53E5\u5B50\u8BCD\u5E93") {
  const books = ensureSentenceBooks(state2);
  const clean = String(name || "").trim() || "\u53E5\u5B50\u8BCD\u5E93";
  let book = books.find((b) => b.name === clean);
  if (!book) {
    book = { id: id("sbook"), name: clean, createdAt: Date.now(), updatedAt: Date.now(), entries: [] };
    books.push(book);
  }
  if (!Array.isArray(book.entries)) book.entries = [];
  return book;
}
function sameSource(entry, sourceTextId, sentenceIndex, sourceSentenceId = null) {
  if (sourceSentenceId && entry.sourceSentenceId) return String(entry.sourceSentenceId) === String(sourceSentenceId);
  return String(entry.sourceTextId || "") === String(sourceTextId || "") && Number(entry.sentenceIndex ?? -1) === Number(sentenceIndex ?? -1);
}
function addSentenceEntry(state2, {
  bookName = "\u53E5\u5B50\u8BCD\u5E93",
  text,
  tokens = [],
  sourceTextId = null,
  sourceSentenceId = null,
  sourceTitle = "",
  sourceCollection = "",
  sentenceIndex = null
} = {}) {
  const book = ensureSentenceBook(state2, bookName);
  const cleanText = String(text || "").trim();
  let entry = book.entries.find((candidate) => candidate.text === cleanText && sameSource(candidate, sourceTextId, sentenceIndex, sourceSentenceId));
  if (entry) {
    entry.updatedAt = Date.now();
    if (sourceTitle) entry.sourceTitle = String(sourceTitle);
    if (sourceCollection) entry.sourceCollection = String(sourceCollection);
    if (sourceTextId) entry.sourceTextId = sourceTextId;
    if (sourceSentenceId) entry.sourceSentenceId = sourceSentenceId;
    if (sentenceIndex != null) entry.sentenceIndex = Number(sentenceIndex);
    return { book, entry, reused: true };
  }
  entry = {
    id: id("sent"),
    text: cleanText,
    sourceTextId: sourceTextId || null,
    sourceSentenceId: sourceSentenceId || null,
    sourceTitle: String(sourceTitle || ""),
    sourceCollection: String(sourceCollection || ""),
    sentenceIndex: sentenceIndex == null ? null : Number(sentenceIndex),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastPracticedAt: 0,
    practiceStatus: "unseen",
    wholeAttempts: [],
    tokens: tokens.map((surface, index) => ({
      id: id(`tok${index}`),
      surface: String(surface),
      normalized: normalizeLexeme(surface),
      position: index,
      status: null,
      lastInput: "",
      lastSpellingResult: null,
      attempts: []
    }))
  };
  book.entries.unshift(entry);
  book.updatedAt = Date.now();
  return { book, entry, reused: false };
}
function getSentenceEntry(state2, bookId, entryId) {
  const book = ensureSentenceBooks(state2).find((b) => b.id === bookId);
  const entry = book?.entries?.find((e) => e.id === entryId) || null;
  return { book: book || null, entry };
}
function recordSentenceToken(entry, tokenIndex, { input = "", spellingResult = null, status = null } = {}) {
  const token = entry?.tokens?.[tokenIndex];
  if (!token) return null;
  token.lastInput = String(input || "");
  token.lastSpellingResult = spellingResult === "good" ? "good" : spellingResult === "bad" ? "bad" : null;
  if (status && VALID_STATUS.has(status)) token.status = status;
  token.attempts = Array.isArray(token.attempts) ? token.attempts : [];
  token.attempts.push({ ts: Date.now(), input: token.lastInput, spellingResult: token.lastSpellingResult, status: token.status });
  entry.updatedAt = Date.now();
  return token;
}
function setSentenceTokenStatus(entry, tokenIndex, status) {
  const token = entry?.tokens?.[tokenIndex];
  if (!token || !VALID_STATUS.has(status)) return null;
  token.status = status;
  entry.updatedAt = Date.now();
  return token;
}
function deriveSentencePracticeStatus(entry) {
  if (!entry) return "unseen";
  if (entry.practiceStatus === "ignored") return "ignored";
  if (entry.practiceStatus === "done" || entry.practiceStatus === "repeat") return entry.practiceStatus;
  const tokens = Array.isArray(entry.tokens) ? entry.tokens : [];
  if (tokens.some((token) => token.status === "unfamiliar" || token.status === "unknown")) return "repeat";
  if (Array.isArray(entry.wholeAttempts) && entry.wholeAttempts.length || tokens.some((token) => Array.isArray(token.attempts) && token.attempts.length)) return "done";
  return "unseen";
}
function setSentencePracticeStatus(entry, status) {
  if (!entry || !VALID_PRACTICE_STATUS.has(status)) return null;
  entry.practiceStatus = status;
  entry.lastPracticedAt = Date.now();
  entry.updatedAt = Date.now();
  return entry.practiceStatus;
}
function recordWholeSentenceAttempt(entry, { input = "", alignment = null, revealed = false } = {}) {
  if (!entry) return null;
  entry.wholeAttempts = Array.isArray(entry.wholeAttempts) ? entry.wholeAttempts : [];
  const attempt = {
    ts: Date.now(),
    input: String(input || ""),
    revealed: Boolean(revealed),
    correct: Boolean(!revealed && alignment?.correct),
    distance: Number(alignment?.distance) || 0,
    operations: Array.isArray(alignment?.operations) ? alignment.operations.map((op) => ({
      type: op.type,
      expected: op.expected || "",
      actual: op.actual || "",
      expectedIndex: Number.isInteger(op.expectedIndex) ? op.expectedIndex : null,
      actualIndex: Number.isInteger(op.actualIndex) ? op.actualIndex : null
    })) : []
  };
  entry.wholeAttempts.push(attempt);
  entry.practiceStatus = attempt.correct ? "done" : "repeat";
  entry.lastPracticedAt = attempt.ts;
  entry.updatedAt = attempt.ts;
  return attempt;
}
function sentencePracticeIndexes(state2, entry, {
  onlyProblems = false,
  unique: unique3 = false,
  skipSimple = true,
  statuses = ["unfamiliar", "unknown"]
} = {}) {
  const wanted = new Set(statuses);
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (let index = 0; index < (entry?.tokens || []).length; index += 1) {
    const token = entry.tokens[index];
    const key = token.normalized || normalizeLexeme(token.surface);
    if (onlyProblems && !wanted.has(token.status)) continue;
    if (skipSimple && isSimpleLexeme(state2, key)) continue;
    if (unique3 && seen.has(key)) continue;
    seen.add(key);
    out.push(index);
  }
  return out;
}
function sentenceProblemOccurrences(entry, statuses = ["unfamiliar", "unknown"]) {
  const wanted = new Set(statuses);
  const out = [];
  for (let tokenIndex = 0; tokenIndex < (entry?.tokens || []).length; tokenIndex += 1) {
    const token = entry.tokens[tokenIndex];
    if (!wanted.has(token.status)) continue;
    out.push({
      ...token,
      tokenIndex,
      sentence: entry.text,
      entryId: entry.id,
      sourceTextId: entry.sourceTextId || null,
      sourceTitle: entry.sourceTitle || "",
      sourceCollection: entry.sourceCollection || "",
      sentenceIndex: entry.sentenceIndex == null ? null : Number(entry.sentenceIndex)
    });
  }
  return out;
}
function sentenceProblemTokens(entry, statuses = ["unfamiliar", "unknown"]) {
  const byWord = /* @__PURE__ */ new Map();
  for (const token of sentenceProblemOccurrences(entry, statuses)) {
    const key = token.normalized || normalizeLexeme(token.surface);
    const current = byWord.get(key);
    if (!current) byWord.set(key, { ...token, occurrences: [token] });
    else current.occurrences.push(token);
  }
  return [...byWord.values()];
}
function findSentenceProblemEntries(state2, { bookId = "", query = "" } = {}) {
  const q = String(query || "").trim().toLowerCase();
  const rows = [];
  for (const book of ensureSentenceBooks(state2)) {
    if (bookId && book.id !== bookId) continue;
    for (const entry of book.entries || []) {
      if (deriveSentencePracticeStatus(entry) === "ignored") continue;
      const problems = sentenceProblemOccurrences(entry);
      if (!problems.length) continue;
      const haystack = [
        book.name,
        entry.text,
        entry.sourceTitle,
        entry.sourceCollection,
        entry.sentenceIndex == null ? "" : String(Number(entry.sentenceIndex) + 1),
        problems.map((token) => token.normalized || token.surface).join(" ")
      ].join(" ").toLowerCase();
      if (q && !haystack.includes(q)) continue;
      rows.push({ book, entry, problems });
    }
  }
  return rows.sort((a, b) => Number(b.entry.updatedAt || 0) - Number(a.entry.updatedAt || 0));
}
function sentenceSourceLabel(entry) {
  const parts = [];
  if (entry?.sourceCollection) parts.push(entry.sourceCollection);
  if (entry?.sourceTitle) parts.push(entry.sourceTitle);
  if (entry?.sentenceIndex != null) parts.push(`\u7B2C ${Number(entry.sentenceIndex) + 1} \u53E5`);
  return parts.length ? parts.join(" \xB7 ") : "\u624B\u52A8\u53E5\u5B50";
}
function tsvCell(value) {
  return String(value ?? "").replace(/\t/g, " ").replace(/\r?\n/g, " ");
}
function problemTokensToTSV(tokens, { source = "\u53E5\u5B50\u9519\u9898\u672C", sentence = "" } = {}) {
  const rows = ["en	zh	pos	def	source	example"];
  const seen = /* @__PURE__ */ new Set();
  for (const token of tokens) {
    const en = token.normalized || normalizeLexeme(token.surface);
    if (!en || seen.has(en)) continue;
    seen.add(en);
    rows.push([
      en,
      "",
      "",
      "",
      source,
      token.sentence || sentence || ""
    ].map(tsvCell).join("	"));
  }
  return rows.join("\n");
}
function normalizeSentenceBooks(value) {
  if (!Array.isArray(value)) return [];
  return value.map((book, bi) => ({
    id: book.id || `sbook_legacy_${bi}`,
    name: String(book.name || "\u53E5\u5B50\u8BCD\u5E93"),
    createdAt: Number(book.createdAt) || Date.now(),
    updatedAt: Number(book.updatedAt) || Date.now(),
    entries: (Array.isArray(book.entries) ? book.entries : []).map((entry, ei) => ({
      id: entry.id || `sent_legacy_${bi}_${ei}`,
      text: String(entry.text || ""),
      sourceTextId: entry.sourceTextId || null,
      sourceSentenceId: entry.sourceSentenceId || null,
      sourceTitle: String(entry.sourceTitle || ""),
      sourceCollection: String(entry.sourceCollection || ""),
      sentenceIndex: entry.sentenceIndex == null ? null : Number(entry.sentenceIndex),
      createdAt: Number(entry.createdAt) || Date.now(),
      updatedAt: Number(entry.updatedAt) || Date.now(),
      lastPracticedAt: Number(entry.lastPracticedAt) || 0,
      practiceStatus: VALID_PRACTICE_STATUS.has(entry.practiceStatus) ? entry.practiceStatus : "unseen",
      wholeAttempts: Array.isArray(entry.wholeAttempts) ? entry.wholeAttempts : [],
      tokens: (Array.isArray(entry.tokens) ? entry.tokens : []).map((token, ti) => ({
        id: token.id || `tok_legacy_${bi}_${ei}_${ti}`,
        surface: String(token.surface || ""),
        normalized: normalizeLexeme(token.normalized || token.surface),
        position: Number.isFinite(Number(token.position)) ? Number(token.position) : ti,
        status: VALID_STATUS.has(token.status) ? token.status : null,
        lastInput: String(token.lastInput || ""),
        lastSpellingResult: token.lastSpellingResult === "good" ? "good" : token.lastSpellingResult === "bad" ? "bad" : null,
        attempts: Array.isArray(token.attempts) ? token.attempts : []
      }))
    }))
  }));
}

// src/tokenizer.js
var TOKEN_RE = /[A-Za-z]+\d+[A-Za-z0-9-]*|\d+[A-Za-z]+(?:-[A-Za-z0-9]+)*|(?:[$£€¥]\s*)?\d+(?::\d{1,2})?(?:[.,]\d+)?(?:%|(?:st|nd|rd|th))?|[A-Za-z]+(?:['’-][A-Za-z]+)*/g;
function normalizeToken(value) {
  return String(value || "").trim().toLowerCase().replace(/’/g, "'").replace(/\s+/g, " ");
}
function tokenizeEnglish(text, options = {}) {
  const words = String(text || "").match(TOKEN_RE) || [];
  const normalized = words.map((word) => word.replace(/’/g, "'").replace(/\s+/g, " "));
  if (!options.unique) return normalized;
  const seen = /* @__PURE__ */ new Set();
  return normalized.filter((word) => {
    const key = normalizeToken(word);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
var SMALL = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19 };
var TENS = { twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90 };
var ORDINAL = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30, fortieth: 40, fiftieth: 50, sixtieth: 60, seventieth: 70, eightieth: 80, ninetieth: 90 };
function wordsToNumber(text) {
  const parts = normalizeToken(text).replace(/-/g, " ").split(/\s+/).filter(Boolean).filter((x) => x !== "and");
  if (!parts.length) return null;
  let total = 0, current = 0, used = false;
  for (const p of parts) {
    if (p in SMALL) {
      current += SMALL[p];
      used = true;
    } else if (p in TENS) {
      current += TENS[p];
      used = true;
    } else if (p === "hundred") {
      current = (current || 1) * 100;
      used = true;
    } else if (p === "thousand") {
      total += (current || 1) * 1e3;
      current = 0;
      used = true;
    } else return null;
  }
  return used ? total + current : null;
}
function numericValue(text) {
  const clean = normalizeToken(text).replace(/,/g, "");
  if (/^\d+(?:\.\d+)?$/.test(clean)) return Number(clean);
  return wordsToNumber(clean);
}
function numericCanonical(value) {
  const s = normalizeToken(value).replace(/[–—]/g, "-").replace(/,/g, "").trim();
  let m = s.match(/^£\s*(\d+(?:\.\d+)?)$/);
  if (m) return "gbp:" + Number(m[1]);
  m = s.match(/^(.*?)\s*(?:pounds?|gbp)$/);
  if (m) {
    const n2 = numericValue(m[1]);
    if (n2 != null) return "gbp:" + n2;
  }
  m = s.match(/^\$\s*(\d+(?:\.\d+)?)$/);
  if (m) return "usd:" + Number(m[1]);
  m = s.match(/^(.*?)\s*(?:dollars?|usd)$/);
  if (m) {
    const n2 = numericValue(m[1]);
    if (n2 != null) return "usd:" + n2;
  }
  m = s.match(/^(\d+(?:\.\d+)?)%$/);
  if (m) return "pct:" + Number(m[1]);
  m = s.match(/^(.*?)\s*(?:percent|per cent)$/);
  if (m) {
    const n2 = numericValue(m[1]);
    if (n2 != null) return "pct:" + n2;
  }
  m = s.match(/^(\d{1,2}):(\d{1,2})$/);
  if (m) return "time:" + Number(m[1]) + ":" + String(Number(m[2])).padStart(2, "0");
  m = s.match(/^(.*?)\s+(.*?)$/);
  if (m) {
    const h = numericValue(m[1]), min = numericValue(m[2]);
    if (h != null && min != null && h <= 24 && min < 60) return "time:" + h + ":" + String(min).padStart(2, "0");
  }
  m = s.match(/^(\d+)(?:st|nd|rd|th)$/);
  if (m) return "ord:" + Number(m[1]);
  if (s in ORDINAL) return "ord:" + ORDINAL[s];
  const n = numericValue(s);
  return n == null ? null : "num:" + n;
}
function spellingMatches(input, answer) {
  const exact = normalizeToken(input) === normalizeToken(answer);
  if (exact) return true;
  if (!/[0-9$£€¥%]/.test(String(answer))) return false;
  const a = numericCanonical(answer), b = numericCanonical(input);
  return Boolean(a && b && a === b);
}

// src/textsentences.js
function id2(prefix = "sentence") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
function cleanSegment(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
function fallbackSegments(input) {
  const protectedDots = /* @__PURE__ */ new Map();
  let serial = 0;
  const protect = (match) => {
    const key = `__ABBR_${serial++}__`;
    protectedDots.set(key, match);
    return key;
  };
  let safe = input.replace(/\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|vs|etc)\./gi, protect);
  safe = safe.replace(/\b(?:e\.g\.|i\.e\.|U\.S\.|U\.K\.)/gi, protect);
  const chunks = safe.match(/[^.!?。！？\n]+[.!?。！？]+|[^.!?。！？\n]+(?=\n|$)/g) || [];
  return chunks.map((chunk) => {
    let restored = chunk;
    for (const [key, value] of protectedDots) restored = restored.replaceAll(key, value);
    return cleanSegment(restored);
  }).filter(Boolean);
}
function mergeTitleAbbreviationSegments(rows) {
  const out = [];
  const titleOnly = /^(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St)\.$/i;
  for (const row of rows) {
    const previous = out[out.length - 1];
    if (previous && titleOnly.test(previous.text)) {
      previous.text = cleanSegment(`${previous.text} ${row.text}`);
      previous.end = row.end;
      continue;
    }
    out.push({ ...row });
  }
  return out;
}
function segmentTextSentences(body, locale = "en") {
  const input = String(body || "").replace(/\r/g, "");
  if (!input.trim()) return [];
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    try {
      const segmenter = new Intl.Segmenter(locale, { granularity: "sentence" });
      const rows = [];
      for (const part of segmenter.segment(input)) {
        const text = cleanSegment(part.segment);
        if (text) rows.push({ text, start: Number(part.index) || 0, end: (Number(part.index) || 0) + String(part.segment || "").length });
      }
      const merged = mergeTitleAbbreviationSegments(rows);
      if (merged.length) return merged;
    } catch {
    }
  }
  return fallbackSegments(input).map((text, index) => ({ text, start: index, end: index + text.length }));
}
function sentenceKey(value) {
  return cleanSegment(value).toLowerCase();
}
function reconcileTextSentences(text) {
  if (!text || typeof text !== "object") return [];
  const old = Array.isArray(text.sentences) ? text.sentences : [];
  const oldIndex = Math.max(0, Number(text.sentence) || 0);
  const oldCurrentId = text.currentSentenceId || old[oldIndex]?.id || null;
  const buckets = /* @__PURE__ */ new Map();
  for (const row of old) {
    const key = sentenceKey(row?.text);
    if (!key) continue;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  const now = Date.now();
  const next = segmentTextSentences(text.body).map((segment, index) => {
    const key = sentenceKey(segment.text);
    const reused = buckets.get(key)?.shift() || null;
    return {
      ...reused || {},
      id: reused?.id || id2("tsent"),
      text: segment.text,
      index,
      start: segment.start,
      end: segment.end,
      createdAt: Number(reused?.createdAt) || now,
      updatedAt: reused?.text === segment.text ? Number(reused?.updatedAt) || now : now
    };
  });
  text.sentences = next;
  let currentIndex = oldCurrentId ? next.findIndex((row) => row.id === oldCurrentId) : -1;
  if (currentIndex < 0) currentIndex = Math.min(oldIndex, Math.max(0, next.length - 1));
  text.sentence = next.length ? currentIndex : 0;
  text.currentSentenceId = next[currentIndex]?.id || null;
  return next;
}
function normalizeTexts(value) {
  return (Array.isArray(value) ? value : []).map((text, index) => {
    const normalized = {
      id: text?.id || `text_legacy_${index}`,
      title: String(text?.title || "\u672A\u547D\u540D\u6587\u672C"),
      collection: String(text?.collection || "\u672A\u5206\u7C7B"),
      body: String(text?.body || ""),
      createdAt: Number(text?.createdAt) || Date.now(),
      updatedAt: Number(text?.updatedAt) || Date.now(),
      lastOpened: Number(text?.lastOpened) || 0,
      sentence: Math.max(0, Number(text?.sentence) || 0),
      currentSentenceId: text?.currentSentenceId || null,
      hidden: Boolean(text?.hidden),
      loop: Boolean(text?.loop),
      sentences: Array.isArray(text?.sentences) ? text.sentences : []
    };
    reconcileTextSentences(normalized);
    return normalized;
  });
}
function normalizedWords(value) {
  return tokenizeEnglish(value).map((word) => word.toLowerCase().replace(/’/g, "'"));
}
function alignSentenceInput(expectedText, actualText) {
  const expected = tokenizeEnglish(expectedText);
  const actual = tokenizeEnglish(actualText);
  const a = expected.map((word) => word.toLowerCase().replace(/’/g, "'"));
  const b = actual.map((word) => word.toLowerCase().replace(/’/g, "'"));
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i2 = 0; i2 < rows; i2 += 1) dp[i2][0] = i2;
  for (let j2 = 0; j2 < cols; j2 += 1) dp[0][j2] = j2;
  for (let i2 = 1; i2 < rows; i2 += 1) {
    for (let j2 = 1; j2 < cols; j2 += 1) {
      const replace = dp[i2 - 1][j2 - 1] + (a[i2 - 1] === b[j2 - 1] ? 0 : 1);
      const missing = dp[i2 - 1][j2] + 1;
      const extra = dp[i2][j2 - 1] + 1;
      dp[i2][j2] = Math.min(replace, missing, extra);
    }
  }
  const operations = [];
  let i = a.length;
  let j = b.length;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && dp[i][j] === dp[i - 1][j - 1]) {
      operations.push({ type: "equal", expected: expected[i - 1], actual: actual[j - 1], expectedIndex: i - 1, actualIndex: j - 1 });
      i -= 1;
      j -= 1;
      continue;
    }
    if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      operations.push({ type: "replace", expected: expected[i - 1], actual: actual[j - 1], expectedIndex: i - 1, actualIndex: j - 1 });
      i -= 1;
      j -= 1;
      continue;
    }
    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      operations.push({ type: "missing", expected: expected[i - 1], actual: "", expectedIndex: i - 1, actualIndex: null });
      i -= 1;
      continue;
    }
    operations.push({ type: "extra", expected: "", actual: actual[j - 1], expectedIndex: null, actualIndex: j - 1 });
    j -= 1;
  }
  operations.reverse();
  const correct = operations.length === expected.length && operations.every((op) => op.type === "equal");
  const wrongExpectedIndexes = [...new Set(operations.filter((op) => op.type === "replace" || op.type === "missing").map((op) => op.expectedIndex).filter(Number.isInteger))];
  return {
    expected,
    actual,
    normalizedExpected: normalizedWords(expectedText),
    normalizedActual: normalizedWords(actualText),
    operations,
    distance: dp[a.length][b.length],
    correct,
    wrongExpectedIndexes
  };
}

// src/storage.js
var DB_NAME = "listenwrite-v3";
var DB_VERSION = 1;
var STORE = "kv";
var STATE_KEY = "state";
var LEGACY_KEY = "listenwrite-v2";
var FALLBACK_KEY = "listenwrite-v3-fallback";
var STATE_VERSION = 10;
var dbPromise = null;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
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
  return {
    version: STATE_VERSION,
    words: [],
    events: [],
    texts: [],
    sentenceBooks: [],
    simpleWords: [],
    errorBooks: [],
    dailyPlans: {},
    activities: [],
    settings: {
      defaultNewTarget: 30,
      defaultReviewTarget: 80,
      retention: 0.9,
      speechRate: 0.92,
      todayBooks: [],
      typeBooks: [],
      todayPlanMode: "mixed"
    }
  };
}
function sampleWords() {
  return [
    ["distribution", "\u5206\u5E03\uFF1B\u5206\u914D", "n.", "the way something is spread or shared"],
    ["rural", "\u4E61\u6751\u7684\uFF1B\u519C\u6751\u7684", "adj.", "connected with the countryside"],
    ["decline", "\u4E0B\u964D\uFF1B\u51CF\u5C11", "n./v.", "to become smaller, fewer or less"],
    ["agriculture", "\u519C\u4E1A", "n.", "the practice of farming"],
    ["significant", "\u663E\u8457\u7684\uFF1B\u91CD\u8981\u7684", "adj.", "large or important enough to be noticed"]
  ].map(([en, zh, pos, def], i) => ({
    id: `sample_${i + 1}`,
    en,
    zh,
    pos,
    def,
    sources: ["\u793A\u4F8B\u8BCD\u5E93"],
    examples: [],
    retired: false,
    card: emptyCard()
  }));
}
function normalizeWord(word, index) {
  return {
    id: word.id || `w_${Date.now().toString(36)}_${index}`,
    en: normalizeLexeme(word.en),
    zh: String(word.zh || ""),
    pos: String(word.pos || ""),
    def: String(word.def || ""),
    sources: Array.isArray(word.sources) ? [...new Set(word.sources)] : Array.isArray(word.src) ? [...new Set(word.src)] : [],
    examples: Array.isArray(word.examples) ? [...new Set(word.examples)] : Array.isArray(word.ex) ? [...new Set(word.ex)] : [],
    retired: Boolean(word.retired ?? word.ret),
    reviewHint: Boolean(word.reviewHint ?? word.priorExposure),
    needsMeaning: Boolean(word.needsMeaning) && !String(word.zh || "").trim(),
    card: word.card || null
  };
}
function normalizeEvent(event, index, preserveDate) {
  const ts = Number(event.ts) || Date.now();
  return {
    id: event.id || `legacy_ev_${index}`,
    wordId: event.wordId,
    date: preserveDate && event.date ? event.date : calendarDayKey(ts),
    ts,
    mode: event.mode === "type" ? "type" : "listen",
    result: event.result || event.res || "bad",
    originalResult: event.originalResult || event.result || event.res || "bad",
    cold: false,
    attempt: 1,
    source: event.source || null,
    sentence: event.sentence || null,
    editedAt: event.editedAt || null
  };
}
function normalizeSegment(segment, index) {
  return {
    id: segment.id || `seg_${index}`,
    book: String(segment.book || ""),
    newTarget: Math.max(0, Number(segment.newTarget) || 0),
    reviewTarget: Math.max(0, Number(segment.reviewTarget) || 0),
    newIds: Array.isArray(segment.newIds) ? segment.newIds : [],
    reviewIds: Array.isArray(segment.reviewIds) ? segment.reviewIds : []
  };
}
function normalizePlan(plan, key) {
  const segments = Array.isArray(plan.bookSegments) ? plan.bookSegments.map(normalizeSegment) : [];
  return {
    date: plan.date || key,
    mode: plan.mode === "sequential" ? "sequential" : "mixed",
    books: Array.isArray(plan.books) ? plan.books : [],
    newTarget: Math.max(0, Number(plan.newTarget) || 0),
    reviewTarget: Math.max(0, Number(plan.reviewTarget) || 0),
    newIds: Array.isArray(plan.newIds) ? plan.newIds : [],
    reviewIds: Array.isArray(plan.reviewIds) ? plan.reviewIds : [],
    bookSegments: segments,
    resumeWordId: plan.resumeWordId || null,
    drawNonce: Math.max(0, Number(plan.drawNonce) || 0),
    createdAt: Number(plan.createdAt) || Date.now(),
    updatedAt: Number(plan.updatedAt) || Date.now()
  };
}
function reindexEvents(events) {
  const firstListenByWordDay = /* @__PURE__ */ new Set();
  const attempts = /* @__PURE__ */ new Map();
  events.sort((a, b) => a.ts - b.ts);
  for (const e of events) {
    const dayKey2 = `${e.wordId}|${e.date}`;
    if (e.mode === "listen") {
      e.cold = !firstListenByWordDay.has(dayKey2);
      firstListenByWordDay.add(dayKey2);
    } else {
      e.cold = false;
    }
    const attemptKey = `${dayKey2}|${e.mode}`;
    const n = (attempts.get(attemptKey) || 0) + 1;
    attempts.set(attemptKey, n);
    e.attempt = n;
  }
  return events;
}
function normalizeActivities(list, preserveDate) {
  return (Array.isArray(list) ? list : []).map((a) => ({
    ...a,
    date: preserveDate && a.date ? a.date : calendarDayKey(Number(a.start) || Number(a.lastTouch) || Date.now())
  }));
}
function normalizeState(input) {
  const base = defaultState();
  const inputVersion = Number(input?.version) || 0;
  const migrateScheduling = inputVersion < STATE_VERSION;
  const oldSettings = input?.settings || input?.set || {};
  const state2 = { ...base, ...input || {} };
  const oldNew = Number(oldSettings.defaultNewTarget ?? oldSettings.newTarget ?? oldSettings.newN ?? base.settings.defaultNewTarget);
  const oldReview = Number(oldSettings.defaultReviewTarget ?? oldSettings.reviewTarget ?? oldSettings.reviewN ?? base.settings.defaultReviewTarget);
  state2.settings = {
    ...base.settings,
    ...oldSettings,
    defaultNewTarget: Math.max(0, oldNew || 0),
    defaultReviewTarget: Math.max(0, oldReview || 0),
    todayPlanMode: oldSettings.todayPlanMode === "sequential" ? "sequential" : "mixed"
  };
  if (input?.set) {
    state2.settings.speechRate = Number(input.set.rate ?? state2.settings.speechRate);
    state2.settings.todayBooks = Array.isArray(input.set.todayBooks) ? input.set.todayBooks : [];
    state2.settings.typeBooks = Array.isArray(input.set.typeBooks) ? input.set.typeBooks : [];
  }
  delete state2.settings.newTarget;
  delete state2.settings.reviewTarget;
  delete state2.settings.newN;
  delete state2.settings.reviewN;
  delete state2.settings.rate;
  state2.settings.retention = Math.min(0.97, Math.max(0.75, Number(state2.settings.retention) || 0.9));
  const preserveDates = inputVersion >= 4;
  state2.words = (input?.words || []).map(normalizeWord).filter((w) => w.en);
  state2.events = reindexEvents((input?.events || []).map((e, i) => normalizeEvent(e, i, preserveDates)).filter((e) => e.wordId));
  state2.texts = normalizeTexts(input?.texts);
  state2.sentenceBooks = normalizeSentenceBooks(input?.sentenceBooks);
  state2.simpleWords = Array.isArray(input?.simpleWords) ? [...new Set(input.simpleWords.map(normalizeLexeme).filter(Boolean))] : [];
  ensureSimpleWords(state2);
  const inferredErrorBooks = new Set(Array.isArray(input?.errorBooks) ? input.errorBooks.map(String).filter(Boolean) : []);
  for (const word of state2.words) for (const source of word.sources || []) if (/错题|错词|error/i.test(source)) inferredErrorBooks.add(source);
  state2.errorBooks = [...inferredErrorBooks];
  state2.activities = normalizeActivities(input?.activities, preserveDates);
  state2.dailyPlans = {};
  if (inputVersion >= 4 && input?.dailyPlans && typeof input.dailyPlans === "object" && !Array.isArray(input.dailyPlans)) {
    for (const [key, plan] of Object.entries(input.dailyPlans)) state2.dailyPlans[key] = normalizePlan(plan, key);
  }
  for (const word of state2.words) {
    if (state2.simpleWords.includes(word.en)) word.retired = true;
    const evs = state2.events.filter((e) => e.wordId === word.id && e.cold && e.mode === "listen").sort((a, b) => a.ts - b.ts);
    if (migrateScheduling) {
      word.card = evs.length ? rebuildCard(evs, state2.settings.retention) : emptyCard();
    } else if (!word.card) {
      word.card = evs.length ? rebuildCard(evs, state2.settings.retention) : emptyCard();
    }
  }
  state2.version = STATE_VERSION;
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
    return normalizeState(state2);
  } catch {
    const fallback = await parseLocal(FALLBACK_KEY);
    if (fallback) return fallback;
    const legacy = await parseLocal(LEGACY_KEY);
    const state2 = legacy || defaultState();
    if (!state2.words.length) state2.words = sampleWords();
    return normalizeState(state2);
  }
}
async function saveState(state2) {
  state2.version = STATE_VERSION;
  ensureSimpleWords(state2);
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

// src/reinforcement.js
var REQUIRED_GOOD_STREAK = 3;
function reinforcementState(events = []) {
  const list = [...events].sort((a, b) => Number(a.ts || 0) - Number(b.ts || 0));
  if (!list.length) return { started: false, hadBad: false, goodStreak: 0, required: 1, passed: false, last: null };
  let hadBad = false;
  let goodStreak = 0;
  for (const event of list) {
    if (event.result === "bad") {
      hadBad = true;
      goodStreak = 0;
    } else if (event.result === "good") {
      if (hadBad) goodStreak += 1;
      else goodStreak = 1;
    }
  }
  const required = hadBad ? REQUIRED_GOOD_STREAK : 1;
  return {
    started: true,
    hadBad,
    goodStreak,
    required,
    passed: hadBad ? goodStreak >= REQUIRED_GOOD_STREAK : list.at(-1)?.result === "good",
    last: list.at(-1) || null
  };
}
var REINFORCEMENT_GAPS = [5, 8, 12];
function reinforcementGapWords(events = []) {
  const state2 = reinforcementState(events);
  if (!state2.started || state2.passed || !state2.hadBad) return 0;
  if (state2.last?.result === "bad") return REINFORCEMENT_GAPS[0];
  if (state2.goodStreak === 1) return REINFORCEMENT_GAPS[1];
  if (state2.goodStreak === 2) return REINFORCEMENT_GAPS[2];
  return 0;
}
function reinforcementLabel(events = []) {
  const state2 = reinforcementState(events);
  if (!state2.started) return "\u672A\u5F00\u59CB";
  if (state2.passed) return "\u5DF2\u719F\u6089";
  if (state2.hadBad) return `\u5DE9\u56FA ${state2.goodStreak}/${REQUIRED_GOOD_STREAK}`;
  return state2.last?.result === "bad" ? "\u5F85\u5DE9\u56FA" : "\u672A\u5F00\u59CB";
}

// src/engine.js
var dayKey = calendarDayKey;
function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
function wordEvents(state2, wordId) {
  return state2.events.filter((e) => e.wordId === wordId).sort((a, b) => a.ts - b.ts);
}
function eventsOnDay(state2, wordId, date = dayKey(), mode = null) {
  return state2.events.filter((e) => e.wordId === wordId && e.date === date && (!mode || e.mode === mode)).sort((a, b) => a.ts - b.ts);
}
function hasEventBefore(state2, wordId, date = dayKey()) {
  return state2.events.some((e) => e.wordId === wordId && e.mode === "listen" && e.date < date);
}
function isDailyPlanComplete(state2, date, ts = Date.now()) {
  const plan = state2.dailyPlans?.[date];
  if (!plan) return true;
  const ids = [.../* @__PURE__ */ new Set([...plan.newIds || [], ...plan.reviewIds || []])].filter((id3) => state2.words.some((w) => w.id === id3));
  if (!ids.length) return true;
  for (const id3 of ids) {
    const word = state2.words.find((w) => w.id === id3);
    if (word?.retired) continue;
    const events = state2.events.filter((e) => e.wordId === id3 && e.date === date && e.mode === "listen" && e.ts <= ts).sort((a, b) => a.ts - b.ts);
    if (!reinforcementState(events).passed) return false;
  }
  return true;
}
function activeStudyDayKey(state2, ts = Date.now()) {
  const calendar = calendarDayKey(ts);
  if (!isGraceWindow(ts)) return calendar;
  const previous = addStudyDays(calendar, -1);
  const previousPlan = state2?.dailyPlans?.[previous];
  if (!previousPlan) return calendar;
  return isDailyPlanComplete(state2, previous, ts) ? calendar : previous;
}
function recordAttempt(state2, word, mode, result, context = {}) {
  const ts = context.ts || Date.now();
  const date = context.date || activeStudyDayKey(state2, ts);
  const cold = mode === "listen" && !state2.events.some((e) => e.wordId === word.id && e.date === date && e.mode === "listen");
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
    word.card = events.some((e) => e.cold && e.mode === "listen") ? rebuildCard(events, state2.settings.retention) : word.card || emptyCard();
  }
}

// src/studyidentity.js
function isReviewHinted(word) {
  return Boolean(word?.reviewHint) || (word?.sources || []).some((source) => /错题|错词|error/i.test(source));
}
function wordStudyKind(state2, wordOrId, date) {
  const word = typeof wordOrId === "string" ? state2.words.find((w) => w.id === wordOrId) : wordOrId;
  if (!word) return "new";
  return hasEventBefore(state2, word.id, date) || isReviewHinted(word) ? "review" : "new";
}
function wordPassedOnDay(state2, wordOrId, date) {
  const wordId = typeof wordOrId === "string" ? wordOrId : wordOrId?.id;
  if (!wordId) return false;
  return reinforcementState(eventsOnDay(state2, wordId, date, "listen")).passed;
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
function sameBooks(a = [], b = []) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}
function listenedToday(state2, id3, date) {
  return state2.events.some((e) => e.wordId === id3 && e.date === date && e.mode === "listen");
}
function attemptedCount(state2, ids, date) {
  return ids.filter((id3) => listenedToday(state2, id3, date)).length;
}
function reviewHinted(word) {
  return isReviewHinted(word);
}
function reviewKnown(state2, word, date) {
  return Boolean(word) && wordStudyKind(state2, word, date) === "review";
}
function hash32(value) {
  let h = 2166136261;
  for (const ch of String(value || "")) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function drawSeed(date, books = [], nonce = 0) {
  const scope = books.length ? [...books].sort().join("|") : "__all__";
  return `${date}|${scope}|${Number(nonce) || 0}`;
}
function randomRank(wordId, seed) {
  return hash32(`${seed}|${wordId}`);
}
function reviewCandidates(state2, pool, assigned, date, books = [], nonce = 0) {
  const cutoff = studyDayEnd(date);
  const now = Date.now();
  const seed = drawSeed(date, books, nonce);
  return pool.filter((w) => !assigned.has(w.id) && !wordPassedOnDay(state2, w.id, date) && reviewKnown(state2, w, date)).sort((a, b) => {
    const ah = !hasEventBefore(state2, a.id, date) && reviewHinted(a);
    const bh = !hasEventBefore(state2, b.id, date) && reviewHinted(b);
    if (ah !== bh) return ah ? -1 : 1;
    const adue = hasEventBefore(state2, a.id, date) && (a.card?.reps || 0) > 0 && Number(a.card?.due || 0) <= cutoff;
    const bdue = hasEventBefore(state2, b.id, date) && (b.card?.reps || 0) > 0 && Number(b.card?.due || 0) <= cutoff;
    if (adue !== bdue) return adue ? -1 : 1;
    if (ah && bh) return randomRank(a.id, seed) - randomRank(b.id, seed);
    const ra = retrievability(a.card, now, state2.settings.retention);
    const rb = retrievability(b.card, now, state2.settings.retention);
    if (ra !== rb) return ra - rb;
    const da = Number(a.card?.due || Number.MAX_SAFE_INTEGER);
    const db = Number(b.card?.due || Number.MAX_SAFE_INTEGER);
    if (da !== db) return da - db;
    return randomRank(a.id, seed) - randomRank(b.id, seed);
  });
}
function freshCandidates(state2, pool, assigned, date, books = [], nonce = 0) {
  const seed = drawSeed(date, books, nonce);
  return pool.filter((w) => !assigned.has(w.id) && !wordPassedOnDay(state2, w.id, date) && !reviewKnown(state2, w, date)).sort((a, b) => randomRank(a.id, seed) - randomRank(b.id, seed));
}
function restoreUntouchedNewRandomOrder(state2, ids, date, books = [], nonce = 0) {
  const seed = drawSeed(date, books, nonce);
  const attempted = ids.filter((id3) => listenedToday(state2, id3, date));
  const untouched = ids.filter((id3) => !listenedToday(state2, id3, date)).sort((a, b) => randomRank(a, seed) - randomRank(b, seed));
  return [...attempted, ...untouched];
}
function seedTodayFromListenHistory(state2, plan) {
  if (plan.mode === "sequential") return;
  const seen = /* @__PURE__ */ new Set([...plan.newIds, ...plan.reviewIds]);
  const listenedIds = [...new Set(state2.events.filter((e) => e.date === plan.date && e.mode === "listen").map((e) => e.wordId))];
  for (const id3 of listenedIds) {
    if (seen.has(id3) || wordPassedOnDay(state2, id3, plan.date)) continue;
    const word = state2.words.find((w) => w.id === id3);
    if (!word || !matchesBooks(word, plan.books)) continue;
    if (wordStudyKind(state2, word, plan.date) === "review") plan.reviewIds.push(id3);
    else plan.newIds.push(id3);
    seen.add(id3);
  }
}
function normalizeMixedPlanIdentity(state2, plan) {
  const ids = [.../* @__PURE__ */ new Set([...plan.newIds || [], ...plan.reviewIds || []])];
  plan.newIds = [];
  plan.reviewIds = [];
  for (const id3 of ids) {
    const word = state2.words.find((w) => w.id === id3);
    if (!word) continue;
    if (wordStudyKind(state2, word, plan.date) === "review") plan.reviewIds.push(id3);
    else plan.newIds.push(id3);
  }
}
function reconcileScope(state2, plan, books) {
  if (sameBooks(plan.books, books)) return;
  const carry = [.../* @__PURE__ */ new Set([...plan.newIds || [], ...plan.reviewIds || []])].filter((id3) => {
    const word = state2.words.find((w) => w.id === id3);
    return Boolean(word) && !word.retired && listenedToday(state2, id3, plan.date) && !wordPassedOnDay(state2, id3, plan.date) && matchesBooks(word, books);
  });
  plan.newIds = [];
  plan.reviewIds = [];
  for (const id3 of carry) {
    const word = state2.words.find((w) => w.id === id3);
    if (wordStudyKind(state2, word, plan.date) === "review") plan.reviewIds.push(id3);
    else plan.newIds.push(id3);
  }
  plan.resumeWordId = carry.includes(plan.resumeWordId) ? plan.resumeWordId : null;
  plan.books = [...books];
  plan.drawNonce = (Number(plan.drawNonce) || 0) + 1;
}
function trimIdsToTarget(state2, ids, date, target) {
  const attempted = ids.filter((id3) => listenedToday(state2, id3, date));
  const untouched = ids.filter((id3) => !listenedToday(state2, id3, date));
  const keepUntouched = Math.max(0, target - attempted.length);
  return [...attempted, ...untouched.slice(0, keepUntouched)];
}
function syncSequentialTotals(plan) {
  plan.newIds = [];
  plan.reviewIds = [];
  for (const segment of plan.bookSegments || []) {
    plan.newIds.push(...segment.newIds);
    plan.reviewIds.push(...segment.reviewIds);
  }
  plan.newIds = [...new Set(plan.newIds)];
  plan.reviewIds = [...new Set(plan.reviewIds.filter((id3) => !plan.newIds.includes(id3)))];
  plan.newTarget = (plan.bookSegments || []).reduce((sum, x) => sum + x.newTarget, 0);
  plan.reviewTarget = (plan.bookSegments || []).reduce((sum, x) => sum + x.reviewTarget, 0);
  plan.books = (plan.bookSegments || []).map((x) => x.book).filter(Boolean);
}
function ensureDailyPlan(state2, options = {}) {
  const date = options.date || activeStudyDayKey(state2);
  let plan = state2.dailyPlans[date];
  if (!plan) {
    plan = state2.dailyPlans[date] = {
      date,
      mode: state2.settings.todayPlanMode === "sequential" ? "sequential" : "mixed",
      books: [...options.books ?? state2.settings.todayBooks ?? []],
      newTarget: Math.max(0, Number(state2.settings.defaultNewTarget) || 0),
      reviewTarget: Math.max(0, Number(state2.settings.defaultReviewTarget) || 0),
      newIds: [],
      reviewIds: [],
      bookSegments: [],
      resumeWordId: null,
      drawNonce: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  }
  if (options.mode === "mixed" && plan.mode !== "mixed") {
    convertPlanToMixed(state2, plan, options.books ?? plan.books);
  }
  if (plan.mode === "sequential") {
    plan.updatedAt = Date.now();
    syncSequentialTotals(plan);
    return plan;
  }
  if (Object.prototype.hasOwnProperty.call(options, "books")) reconcileScope(state2, plan, options.books || []);
  seedTodayFromListenHistory(state2, plan);
  normalizeMixedPlanIdentity(state2, plan);
  const minNew = attemptedCount(state2, plan.newIds, plan.date);
  const minReview = attemptedCount(state2, plan.reviewIds, plan.date);
  if (options.newTarget != null) plan.newTarget = Math.max(minNew, Math.max(0, Number(options.newTarget) || 0));
  else plan.newTarget = Math.max(minNew, Number(plan.newTarget) || 0);
  if (options.reviewTarget != null) plan.reviewTarget = Math.max(minReview, Math.max(0, Number(options.reviewTarget) || 0));
  else plan.reviewTarget = Math.max(minReview, Number(plan.reviewTarget) || 0);
  plan.newIds = restoreUntouchedNewRandomOrder(state2, plan.newIds, plan.date, plan.books, plan.drawNonce);
  plan.newIds = trimIdsToTarget(state2, plan.newIds, plan.date, plan.newTarget);
  plan.reviewIds = trimIdsToTarget(state2, plan.reviewIds, plan.date, plan.reviewTarget);
  fillDailyPlan(state2, plan);
  plan.updatedAt = Date.now();
  return plan;
}
function fillDailyPlan(state2, plan) {
  if (plan.mode === "sequential") return fillSequentialPlan(state2, plan);
  const assigned = /* @__PURE__ */ new Set([...plan.newIds, ...plan.reviewIds]);
  const pool = state2.words.filter((w) => !w.retired && matchesBooks(w, plan.books));
  const review = reviewCandidates(state2, pool, assigned, plan.date, plan.books, plan.drawNonce);
  const fresh = freshCandidates(state2, pool, assigned, plan.date, plan.books, plan.drawNonce);
  const needReview = Math.max(0, plan.reviewTarget - plan.reviewIds.length);
  const needNew = Math.max(0, plan.newTarget - plan.newIds.length);
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
function configureSequentialPlan(state2, plan, configs = []) {
  const clean = [];
  const seenBooks = /* @__PURE__ */ new Set();
  for (const row of configs) {
    const book = String(row.book || "").trim();
    if (!book || seenBooks.has(book)) continue;
    seenBooks.add(book);
    const prior = (plan.bookSegments || []).find((x) => x.book === book);
    clean.push({
      id: prior?.id || `seg_${Math.random().toString(36).slice(2, 9)}`,
      book,
      newTarget: Math.max(0, Number(row.newTarget ?? prior?.newTarget) || 0),
      reviewTarget: Math.max(0, Number(row.reviewTarget ?? prior?.reviewTarget) || 0),
      newIds: prior?.newIds ? [...prior.newIds] : [],
      reviewIds: prior?.reviewIds ? [...prior.reviewIds] : []
    });
  }
  plan.mode = "sequential";
  plan.bookSegments = clean;
  fillSequentialPlan(state2, plan);
  plan.updatedAt = Date.now();
  return plan;
}
function fillSequentialPlan(state2, plan) {
  const assigned = /* @__PURE__ */ new Set();
  const listenedIds = [...new Set(state2.events.filter((e) => e.date === plan.date && e.mode === "listen").map((e) => e.wordId))];
  for (const segment of plan.bookSegments || []) {
    const pool = state2.words.filter((w) => !w.retired && (w.sources || []).includes(segment.book));
    const valid = new Set(pool.map((w) => w.id));
    const existing = [.../* @__PURE__ */ new Set([...segment.newIds || [], ...segment.reviewIds || []])].filter((id3) => valid.has(id3) && !assigned.has(id3));
    segment.newIds = [];
    segment.reviewIds = [];
    for (const id3 of existing) {
      const word = state2.words.find((w) => w.id === id3);
      if (wordStudyKind(state2, word, plan.date) === "review") segment.reviewIds.push(id3);
      else segment.newIds.push(id3);
    }
    const present = /* @__PURE__ */ new Set([...segment.newIds, ...segment.reviewIds]);
    for (const id3 of listenedIds) {
      if (present.has(id3) || assigned.has(id3) || !valid.has(id3) || wordPassedOnDay(state2, id3, plan.date)) continue;
      const word = state2.words.find((w) => w.id === id3);
      if (wordStudyKind(state2, word, plan.date) === "review") segment.reviewIds.push(id3);
      else segment.newIds.push(id3);
      present.add(id3);
    }
    const minNew = attemptedCount(state2, segment.newIds, plan.date);
    const minReview = attemptedCount(state2, segment.reviewIds, plan.date);
    segment.newTarget = Math.max(minNew, Math.max(0, Number(segment.newTarget) || 0));
    segment.reviewTarget = Math.max(minReview, Math.max(0, Number(segment.reviewTarget) || 0));
    segment.newIds = restoreUntouchedNewRandomOrder(state2, segment.newIds, plan.date, [segment.book], plan.drawNonce);
    segment.newIds = trimIdsToTarget(state2, segment.newIds, plan.date, segment.newTarget);
    segment.reviewIds = trimIdsToTarget(state2, segment.reviewIds, plan.date, segment.reviewTarget);
    segment.newIds.forEach((id3) => assigned.add(id3));
    segment.reviewIds.forEach((id3) => assigned.add(id3));
    const review = reviewCandidates(state2, pool, assigned, plan.date, [segment.book], plan.drawNonce);
    for (const w of review.slice(0, Math.max(0, segment.reviewTarget - segment.reviewIds.length))) {
      segment.reviewIds.push(w.id);
      assigned.add(w.id);
    }
    const fresh = freshCandidates(state2, pool, assigned, plan.date, [segment.book], plan.drawNonce);
    for (const w of fresh.slice(0, Math.max(0, segment.newTarget - segment.newIds.length))) {
      segment.newIds.push(w.id);
      assigned.add(w.id);
    }
  }
  syncSequentialTotals(plan);
  return plan;
}
function convertPlanToMixed(state2, plan, books = []) {
  const attempted = [.../* @__PURE__ */ new Set([...plan.newIds || [], ...plan.reviewIds || []])].filter((id3) => listenedToday(state2, id3, plan.date));
  const attemptedNew = attempted.filter((id3) => wordStudyKind(state2, id3, plan.date) === "new");
  const attemptedReview = attempted.filter((id3) => wordStudyKind(state2, id3, plan.date) === "review");
  plan.mode = "mixed";
  plan.bookSegments = [];
  plan.drawNonce = (Number(plan.drawNonce) || 0) + 1;
  plan.books = [...books];
  plan.newTarget = Math.max(attemptedNew.length, Number(state2.settings.defaultNewTarget) || 0);
  plan.reviewTarget = Math.max(attemptedReview.length, Number(state2.settings.defaultReviewTarget) || 0);
  plan.newIds = attemptedNew;
  plan.reviewIds = attemptedReview;
  fillDailyPlan(state2, plan);
  plan.updatedAt = Date.now();
  return plan;
}
function statusForIds(state2, ids, date) {
  const wordMap = new Map(state2.words.map((w) => [w.id, w]));
  let done = 0, retry = 0, pending = 0;
  const doneIds = [], retryIds = [], pendingIds = [];
  for (const id3 of ids) {
    const word = wordMap.get(id3);
    if (!word) continue;
    if (word.retired) {
      done++;
      doneIds.push(id3);
      continue;
    }
    const events = eventsOnDay(state2, id3, date, "listen");
    const reinforce = reinforcementState(events);
    if (!reinforce.started) {
      pending++;
      pendingIds.push(id3);
    } else if (reinforce.passed) {
      done++;
      doneIds.push(id3);
    } else {
      retry++;
      retryIds.push(id3);
    }
  }
  return { done, retry, pending, doneIds, retryIds, pendingIds };
}
function planStatus(state2, plan) {
  return {
    new: statusForIds(state2, plan.newIds, plan.date),
    review: statusForIds(state2, plan.reviewIds, plan.date)
  };
}
function segmentStatus(state2, plan, segment) {
  return {
    new: statusForIds(state2, segment.newIds, plan.date),
    review: statusForIds(state2, segment.reviewIds, plan.date)
  };
}
function currentSequentialSegment(state2, plan) {
  if (plan.mode !== "sequential") return null;
  for (const segment of plan.bookSegments || []) {
    const s = segmentStatus(state2, plan, segment);
    if (s.new.pending + s.new.retry + s.review.pending + s.review.retry > 0) return segment;
  }
  return null;
}
function todayListeningStats(state2, books = [], date = activeStudyDayKey(state2)) {
  const allowed = new Set(state2.words.filter((w) => matchesBooks(w, books)).map((w) => w.id));
  const events = state2.events.filter((e) => e.date === date && e.mode === "listen" && allowed.has(e.wordId));
  const ids = [...new Set(events.map((e) => e.wordId))];
  let newCount = 0, reviewCount = 0, firstGood = 0, firstBad = 0;
  for (const id3 of ids) {
    const word = state2.words.find((w) => w.id === id3);
    if (wordStudyKind(state2, word, date) === "review") reviewCount++;
    else newCount++;
    const first = eventsOnDay(state2, id3, date, "listen")[0];
    if (first?.result === "good") firstGood++;
    else if (first) firstBad++;
  }
  return { events, ids, newCount, reviewCount, firstGood, firstBad };
}
function createRetrySession(state2, plan, mode = "listen", explicitIds = null) {
  const planIds = [...new Set(explicitIds || [...plan.reviewIds, ...plan.newIds])];
  const wordMap = new Map(state2.words.map((w) => [w.id, w]));
  const pendingBase = [];
  const retry = [];
  const completedIds = [];
  for (const id3 of planIds) {
    const word = wordMap.get(id3);
    if (!word || word.retired) continue;
    const events = eventsOnDay(state2, id3, plan.date, mode);
    const reinforce = reinforcementState(events);
    if (!reinforce.started) pendingBase.push(id3);
    else if (reinforce.passed) completedIds.push(id3);
    else retry.push({ wordId: id3, attempt: events.length, eligibleTurn: reinforcementGapWords(events), addedTurn: 0 });
  }
  if (!explicitIds && plan.resumeWordId) {
    const i = pendingBase.indexOf(plan.resumeWordId);
    if (i > 0) pendingBase.unshift(pendingBase.splice(i, 1)[0]);
  }
  return { mode, date: plan.date, fixedIds: planIds, pendingBase, retry, completedIds, turn: 0, current: null, history: [], bufferCursor: 0, lastWordId: null };
}
function retryDue(session) {
  return (session.retry || []).filter((x) => Number(x.eligibleTurn || 0) <= session.turn).sort((a, b) => Number(a.eligibleTurn || 0) - Number(b.eligibleTurn || 0) || Number(a.addedTurn || 0) - Number(b.addedTurn || 0))[0] || null;
}
function pickBufferWord(session) {
  const blocked = new Set((session.retry || []).map((x) => x.wordId));
  const pool = (session.completedIds || []).filter((id4) => !blocked.has(id4) && id4 !== session.lastWordId);
  if (!pool.length) return null;
  const id3 = pool[session.bufferCursor % pool.length];
  session.bufferCursor = (session.bufferCursor + 1) % Math.max(1, pool.length);
  return id3;
}
function pickNext(session) {
  if (session.current) return session.current.wordId;
  const due = retryDue(session);
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
  if (session.retry?.length) {
    const bufferId = pickBufferWord(session);
    if (bufferId) {
      session.current = { wordId: bufferId, source: "buffer", attempt: 0 };
      return bufferId;
    }
    const tail = [...session.retry].sort((a, b) => Number(a.eligibleTurn || 0) - Number(b.eligibleTurn || 0))[0];
    session.retry = session.retry.filter((x) => x !== tail);
    session.current = { wordId: tail.wordId, source: "tail-retry", attempt: tail.attempt + 1, gapShortfall: Math.max(0, Number(tail.eligibleTurn || 0) - session.turn) };
    return tail.wordId;
  }
  return null;
}
function nextRetryGap(session) {
  if (!session?.retry?.length) return 0;
  return Math.max(0, Math.min(...session.retry.map((x) => Number(x.eligibleTurn || 0))) - Number(session.turn || 0));
}
function finishCurrent(session, result, state2 = null) {
  if (!session.current) return;
  const current = session.current;
  session.history.push({ ...current, result, turn: session.turn });
  session.turn += 1;
  session.lastWordId = current.wordId;
  session.retry = (session.retry || []).filter((x) => x.wordId !== current.wordId);
  if (current.source === "buffer") {
    session.current = null;
    return;
  }
  if (state2) {
    const events = eventsOnDay(state2, current.wordId, session.date, session.mode);
    const reinforce = reinforcementState(events);
    session.completedIds = (session.completedIds || []).filter((id3) => id3 !== current.wordId);
    if (reinforce.passed) {
      if (!session.completedIds.includes(current.wordId)) session.completedIds.push(current.wordId);
    } else {
      session.retry.push({
        wordId: current.wordId,
        attempt: events.length,
        eligibleTurn: session.turn + reinforcementGapWords(events),
        addedTurn: session.turn
      });
    }
  }
  session.current = null;
}
function resyncRetryForWord(session, state2, wordId, date = session?.date, mode = session?.mode || "listen") {
  if (!session || !wordId) return;
  session.retry = (session.retry || []).filter((x) => x.wordId !== wordId);
  session.completedIds = (session.completedIds || []).filter((id3) => id3 !== wordId);
  if (session.current?.wordId === wordId || (session.pendingBase || []).includes(wordId)) return;
  const events = eventsOnDay(state2, wordId, date, mode);
  const reinforce = reinforcementState(events);
  if (!reinforce.started) return;
  if (reinforce.passed) {
    session.completedIds.push(wordId);
    return;
  }
  session.retry.push({ wordId, attempt: events.length, eligibleTurn: session.turn + reinforcementGapWords(events), addedTurn: session.turn });
}
function sessionProgress(state2, plan, session) {
  const status = planStatus(state2, plan);
  return {
    newDone: status.new.done,
    newTotal: plan.newIds.length,
    reviewDone: status.review.done,
    reviewTotal: plan.reviewIds.length,
    retry: status.new.retry + status.review.retry,
    remaining: status.new.pending + status.review.pending + status.new.retry + status.review.retry,
    turn: session?.turn || 0
  };
}
function dueForecast(state2, days = 7) {
  const today = activeStudyDayKey(state2);
  const out = Array.from({ length: days }, (_, i) => ({ date: addStudyDays(today, i), count: 0 }));
  const start = studyDayStart(today);
  for (const word of state2.words) {
    if (word.retired || !(word.card?.reps || 0)) continue;
    const due = Number(word.card.due);
    const key = dayKey(due);
    const row = out.find((x) => x.date === key);
    if (row) row.count++;
    else if (due < start) out[0].count++;
  }
  return out;
}

// src/typefilters.js
function unique(ids) {
  return [...new Set(ids)];
}
function typePresetIds(state2, candidates, kind, today, plan = null) {
  const allowed = new Set(candidates.map((w) => w.id));
  const heard = (ids) => unique((ids || []).filter((id3) => allowed.has(id3) && state2.events.some((e) => e.wordId === id3 && e.date === today && e.mode === "listen")));
  const heardPlanIds = heard([...plan?.newIds || [], ...plan?.reviewIds || []]);
  if (kind === "todayNew") return heardPlanIds.filter((id3) => wordStudyKind(state2, id3, today) === "new");
  if (kind === "todayReview") return heardPlanIds.filter((id3) => wordStudyKind(state2, id3, today) === "review");
  if (kind === "todayListen") return unique(state2.events.filter((e) => e.date === today && e.mode === "listen" && e.result === "bad" && allowed.has(e.wordId)).map((e) => e.wordId));
  if (kind === "todayType") return unique(state2.events.filter((e) => e.date === today && e.mode === "type" && e.result === "bad" && allowed.has(e.wordId)).map((e) => e.wordId));
  const sevenDayStart = addStudyDays(today, -6);
  const recentEvents = state2.events.filter((e) => e.date >= sevenDayStart);
  if (kind === "repeat7") {
    const bad = recentEvents.filter((e) => e.result === "bad" && allowed.has(e.wordId));
    return candidates.map((w) => ({ id: w.id, ev: bad.filter((e) => e.wordId === w.id) })).filter((x) => x.ev.length >= 2 || new Set(x.ev.map((e) => e.date)).size >= 2).sort((a, b) => b.ev.length - a.ev.length).map((x) => x.id);
  }
  return candidates.map((w) => {
    const ev = state2.events.filter((e) => e.wordId === w.id);
    const coldBad = ev.filter((e) => e.mode === "listen" && e.cold && e.result === "bad").length;
    const bad = ev.filter((e) => e.result === "bad").length;
    const recent = recentEvents.filter((e) => e.wordId === w.id && e.result === "bad").length;
    const r = retrievability(w.card, Date.now(), state2.settings.retention);
    return { id: w.id, score: coldBad * 5 + bad + recent * 1.5 + (w.card?.reps ? (1 - r) * 2 : 0) };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).map((x) => x.id);
}
function customTypeIdsFromEvents(events, allowedIds, { date, mode = "all", min = 1 } = {}) {
  const allowed = allowedIds instanceof Set ? allowedIds : new Set(allowedIds || []);
  const groups = /* @__PURE__ */ new Map();
  for (const e of events || []) {
    if (e.date !== date || e.result !== "bad" || !allowed.has(e.wordId) || mode !== "all" && e.mode !== mode) continue;
    groups.set(e.wordId, (groups.get(e.wordId) || 0) + 1);
  }
  return [...groups.entries()].filter(([, n]) => n >= Math.max(1, Number(min) || 1)).sort((a, b) => b[1] - a[1]).map(([id3]) => id3);
}

// src/importwords.js
var FIELD_ALIASES = {
  en: ["en", "english", "word", "\u5355\u8BCD", "\u82F1\u6587"],
  zh: ["zh", "chinese", "meaning", "translation", "\u4E2D\u6587", "\u91CA\u4E49", "\u4E2D\u6587\u91CA\u4E49"],
  pos: ["pos", "part of speech", "\u8BCD\u6027"],
  def: ["def", "definition", "english definition", "\u82F1\u6587\u91CA\u4E49"],
  source: ["source", "book", "wordbook", "\u6765\u6E90", "\u8BCD\u4E66"],
  example: ["example", "sentence", "\u4F8B\u53E5"]
};
function cleanCell(value) {
  return String(value ?? "").trim();
}
function delimiterScore(line, delimiter) {
  let quoted = false;
  let count = 0;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') i += 1;
      else quoted = !quoted;
    } else if (!quoted && ch === delimiter) count += 1;
  }
  return count;
}
function detectDelimiter(text) {
  const first = String(text || "").replace(/^\uFEFF/, "").split(/\r?\n/).find((line) => line.trim()) || "";
  return delimiterScore(first, "	") >= delimiterScore(first, ",") && delimiterScore(first, "	") > 0 ? "	" : ",";
}
function parseDelimited(text, delimiter = detectDelimiter(text)) {
  const input = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else quoted = !quoted;
      continue;
    }
    if (!quoted && ch === delimiter) {
      row.push(cleanCell(cell));
      cell = "";
      continue;
    }
    if (!quoted && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      row.push(cleanCell(cell));
      cell = "";
      if (row.some(Boolean)) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cleanCell(cell));
  if (row.some(Boolean)) rows.push(row);
  return rows;
}
function normalizedHeader(value) {
  return cleanCell(value).toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}
function inferFieldMap(rows) {
  const first = rows[0] || [];
  const map = { en: 0, zh: 1, pos: 2, def: 3, source: 4, example: 5 };
  let matches = 0;
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const index = first.findIndex((cell) => aliases.includes(normalizedHeader(cell)));
    if (index >= 0) {
      map[field] = index;
      matches += 1;
    }
  }
  return { map, hasHeader: matches > 0 };
}
function buildImportDraft(text, fileName = "\u5BFC\u5165\u8BCD\u5E93") {
  const delimiter = detectDelimiter(text);
  const rows = parseDelimited(text, delimiter);
  const { map, hasHeader } = inferFieldMap(rows);
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const width = Math.max(0, ...rows.map((row) => row.length));
  return {
    fileName,
    sourceName: String(fileName || "").replace(/\.(csv|txt|tsv)$/i, "") || "\u5BFC\u5165\u8BCD\u5E93",
    delimiter,
    rows: dataRows,
    header: hasHeader ? rows[0] : null,
    width,
    map
  };
}
function recordsFromDraft(draft, map = draft?.map || {}) {
  const rows = Array.isArray(draft?.rows) ? draft.rows : [];
  return rows.map((row, rowIndex) => {
    const value = (field) => {
      const index = Number(map[field]);
      return Number.isInteger(index) && index >= 0 ? cleanCell(row[index]) : "";
    };
    const en = value("en");
    return {
      rowIndex,
      en,
      zh: value("zh"),
      pos: value("pos"),
      def: value("def"),
      source: value("source") || draft.sourceName || "\u5BFC\u5165\u8BCD\u5E93",
      example: value("example"),
      valid: Boolean(en)
    };
  });
}

// src/wordadmin.js
function unique2(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((v) => String(v || "").trim()).filter(Boolean))];
}
function updateWordFields(word, patch = {}) {
  if (!word) return null;
  if ("zh" in patch) {
    word.zh = String(patch.zh || "").trim();
    if (word.zh) word.needsMeaning = false;
  }
  if ("pos" in patch) word.pos = String(patch.pos || "").trim();
  if ("def" in patch) word.def = String(patch.def || "").trim();
  if ("sources" in patch) word.sources = unique2(patch.sources);
  if ("examples" in patch) word.examples = unique2(patch.examples);
  return word;
}
function removeId(list, wordId) {
  return (Array.isArray(list) ? list : []).filter((id3) => id3 !== wordId);
}
function deleteWordEverywhere(state2, wordId) {
  const word = state2.words.find((w) => w.id === wordId);
  if (!word) return false;
  state2.words = state2.words.filter((w) => w.id !== wordId);
  state2.events = (state2.events || []).filter((event) => event.wordId !== wordId);
  state2.simpleWords = (state2.simpleWords || []).filter((lexeme) => lexeme !== word.en);
  for (const plan of Object.values(state2.dailyPlans || {})) {
    plan.newIds = removeId(plan.newIds, wordId);
    plan.reviewIds = removeId(plan.reviewIds, wordId);
    if (plan.resumeWordId === wordId) plan.resumeWordId = null;
    for (const segment of plan.bookSegments || []) {
      segment.newIds = removeId(segment.newIds, wordId);
      segment.reviewIds = removeId(segment.reviewIds, wordId);
    }
  }
  return true;
}
function deleteWordbook(state2, book, { purgeExclusive = false } = {}) {
  const name = String(book || "").trim();
  if (!name) return { affected: 0, removedWords: 0, sharedWords: 0 };
  const matched = state2.words.filter((w) => (w.sources || []).includes(name));
  let removedWords = 0;
  let sharedWords = 0;
  for (const word of [...matched]) {
    const otherSources = (word.sources || []).filter((source) => source !== name);
    if (purgeExclusive && otherSources.length === 0) {
      deleteWordEverywhere(state2, word.id);
      removedWords += 1;
    } else {
      word.sources = otherSources;
      if (otherSources.length) sharedWords += 1;
    }
  }
  state2.settings = state2.settings || {};
  state2.settings.todayBooks = (state2.settings.todayBooks || []).filter((x) => x !== name);
  state2.settings.typeBooks = (state2.settings.typeBooks || []).filter((x) => x !== name);
  if (state2.settings.freeListenProgress && typeof state2.settings.freeListenProgress === "object") delete state2.settings.freeListenProgress[name];
  state2.errorBooks = (state2.errorBooks || []).filter((x) => x !== name);
  for (const plan of Object.values(state2.dailyPlans || {})) {
    plan.books = (plan.books || []).filter((x) => x !== name);
    if (plan.mode === "sequential") {
      plan.bookSegments = (plan.bookSegments || []).filter((segment) => segment.book !== name);
      plan.newIds = [...new Set((plan.bookSegments || []).flatMap((segment) => segment.newIds || []))];
      plan.reviewIds = [...new Set((plan.bookSegments || []).flatMap((segment) => segment.reviewIds || []))];
    }
  }
  return { affected: matched.length, removedWords, sharedWords };
}

// src/usepolish.js
function freeListenCandidates(state2, book, { scope = "all", limit = 0 } = {}) {
  const listened = new Set((state2.events || []).filter((e) => e.mode === "listen").map((e) => e.wordId));
  let ids = (state2.words || []).filter((w) => !w.retired && (w.sources || []).includes(book)).filter((w) => scope !== "unheard" || !listened.has(w.id)).map((w) => w.id);
  if (Number(limit) > 0) ids = ids.slice(0, Number(limit));
  return ids;
}
function linkedSentenceSourceState(state2, entry) {
  if (!entry?.sourceTextId) return "standalone";
  const text = (state2.texts || []).find((t) => t.id === entry.sourceTextId);
  if (!text) return "source-deleted";
  if (!entry.sourceSentenceId) return "legacy-link";
  const exists = (text.sentences || []).some((row) => row.id === entry.sourceSentenceId);
  return exists ? "linked" : "source-changed";
}
function staleLinkedSentenceCount(state2) {
  let count = 0;
  for (const book of state2.sentenceBooks || []) {
    for (const entry of book.entries || []) {
      const status = linkedSentenceSourceState(state2, entry);
      if (status === "source-deleted" || status === "source-changed") count += 1;
    }
  }
  return count;
}
function removeStaleLinkedSentences(state2) {
  let removed = 0;
  state2.sentenceBooks = (state2.sentenceBooks || []).map((book) => {
    const entries = (book.entries || []).filter((entry) => {
      const status = linkedSentenceSourceState(state2, entry);
      const stale = status === "source-deleted" || status === "source-changed";
      if (stale) removed += 1;
      return !stale;
    });
    return { ...book, entries };
  }).filter((book) => (book.entries || []).length > 0);
  return removed;
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
var sentenceRun = null;
var wholeSentenceRun = null;
var wholeQueue = [];
var wordEditId = null;
var importDraft = null;
var freeListen = null;
var statRange = 30;
var statDay = currentDayKey();
var statMonth = calendarDate(statDay);
var saveChain = Promise.resolve();
var saveFailureShown = false;
function currentDayKey(ts = Date.now()) {
  return state ? activeStudyDayKey(state, ts) : dayKey(ts);
}
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
  saveChain = saveChain.then(() => saveState(state)).then(() => {
    saveFailureShown = false;
  }).catch((error) => {
    console.error("Listenwrite save failed", error);
    if (!saveFailureShown) {
      saveFailureShown = true;
      toast("\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u5148\u5BFC\u51FA\u5907\u4EFD\u540E\u518D\u7EE7\u7EED");
    }
  });
  return saveChain;
}
function wordById(id3) {
  return state.words.find((w) => w.id === id3);
}
function pct(a, b) {
  return b ? `${Math.round(a * 100 / b)}%` : "\u2014";
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
  const a = { id: uid("act"), mode, label, books: [...books], date: currentDayKey(), start: Date.now(), lastTouch: Date.now(), activeMs: 0 };
  state.activities.push(a);
  persist();
  return a.id;
}
function touchActivity(id3) {
  const a = state.activities.find((x) => x.id === id3);
  if (!a) return;
  const now = Date.now();
  const last = a.lastTouch || a.start || now;
  a.activeMs = (a.activeMs || 0) + Math.max(0, Math.min(now - last, 9e4));
  a.lastTouch = now;
  persist();
}
function activityMinutes(mode = null, date = currentDayKey()) {
  const list = state.activities.filter((a) => a.date === date && (!mode || a.mode === mode));
  const ms = list.reduce((sum, a) => sum + (a.activeMs || Math.max(0, (a.end || a.start) - a.start) || 0), 0);
  return ms ? Math.max(1, Math.round(ms / 6e4)) : 0;
}
function navHtml() {
  const items = [["home", "\u9996\u9875"], ["today", "\u4ECA\u65E5"], ["type", "\u624B\u6253"], ["text", "\u6587\u672C"], ["library", "\u8BCD\u5E93"]];
  return `<nav class="nav">${items.map(([id3, t]) => `<button data-nav="${id3}" class="${view === id3 ? "on" : ""}">${t}</button>`).join("")}</nav>`;
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
  sentenceRun = null;
  wholeSentenceRun = null;
  wholeQueue = [];
  freeListen = null;
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
function planWordKind(plan, id3) {
  return wordStudyKind(state, id3, plan?.date || currentDayKey()) === "review" ? "\u590D\u4E60" : "\u65B0\u8BCD";
}
function planWordBook(plan, id3) {
  if (plan?.mode !== "sequential") return "";
  const seg = (plan.bookSegments || []).find((x) => (x.newIds || []).includes(id3) || (x.reviewIds || []).includes(id3));
  return seg?.book || "";
}
function planWordMark(plan, id3) {
  const w = wordById(id3);
  if (!w) return { label: "\u5DF2\u79FB\u9664", cls: "mark-pending" };
  if (w.retired || isSimpleLexeme(state, w.en)) return { label: "\u7B80\u5355", cls: "mark-simple" };
  const events = eventsOnDay(state, id3, plan.date, "listen");
  const r = reinforcementState(events);
  if (!r.started) return { label: "\u672A\u5F00\u59CB", cls: "mark-pending" };
  if (r.passed) return { label: "\u5DF2\u719F\u6089", cls: "mark-good" };
  return { label: reinforcementLabel(events), cls: "mark-bad" };
}
function planChecklistHtml(plan, currentId = null) {
  const group = (title, ids) => {
    const rows = (ids || []).map((id3, index) => {
      const w = wordById(id3);
      if (!w) return "";
      const mark = planWordMark(plan, id3), book = planWordBook(plan, id3);
      return `<div class="study-word-row ${id3 === currentId ? "current" : ""}"><span class="en">${index + 1}. ${esc(w.en)}</span><span class="zh">${esc(w.zh || "\u2014")}</span><span class="${mark.cls}">${mark.label}</span><span class="small">${book ? esc(book) : planWordKind(plan, id3)}</span></div>`;
    }).join("");
    const done = (ids || []).filter((id3) => ["\u5DF2\u719F\u6089", "\u7B80\u5355"].includes(planWordMark(plan, id3).label)).length;
    return `<div class="study-list-group"><div class="study-list-title"><b>${title}</b><span>${done} / ${(ids || []).length}</span></div>${rows || '<div class="empty">\u8FD9\u4E00\u7C7B\u6CA1\u6709\u8BCD\u3002</div>'}</div>`;
  };
  return `<div class="study-list">${group("\u65B0\u8BCD", plan?.newIds || [])}${group("\u590D\u4E60\u8BCD", plan?.reviewIds || [])}</div>`;
}
function typeWordKind(id3, date = currentDayKey()) {
  return wordStudyKind(state, id3, date) === "review" ? "\u590D\u4E60\u8BCD" : "\u65B0\u8BCD";
}
function registerErrorBook(name) {
  const clean = String(name || "").trim();
  if (!clean) return;
  state.errorBooks = Array.isArray(state.errorBooks) ? state.errorBooks : [];
  if (!state.errorBooks.includes(clean)) state.errorBooks.push(clean);
}
function errorBookNames() {
  const names = new Set(Array.isArray(state.errorBooks) ? state.errorBooks : []);
  for (const w of state.words) for (const source of w.sources || []) if (/错题|错词|error/i.test(source)) names.add(source);
  return [...names].filter(Boolean).sort((a, b) => a.localeCompare(b));
}
function errorBookSectionHtml() {
  const books = errorBookNames();
  if (!books.length) return `<section class="card"><h2 class="section-title">\u9519\u9898\u672C</h2><div class="empty">\u8FD8\u6CA1\u6709\u9519\u9898\u672C\u3002\u53E5\u5B50\u542C\u5199\u7ED3\u675F\u540E\u53EF\u4EE5\u628A\u4E0D\u719F/\u4E0D\u8BA4\u8BC6\u7684\u8BCD\u4E00\u952E\u52A0\u5165\u3002</div></section>`;
  return `<section class="card"><div class="space"><div><h2 class="section-title">\u9519\u9898\u672C</h2><div class="small">\u9ED8\u8BA4\u6298\u53E0\uFF0C\u53EA\u663E\u793A\u540D\u79F0\u548C\u8BCD\u6570\uFF1B\u5C55\u5F00\u540E\u7528\u7D27\u51D1\u5217\u8868\u67E5\u770B\u3002</div></div></div><div class="error-books">${books.map((book) => {
    const words = state.words.filter((w) => (w.sources || []).includes(book));
    const preview = words.slice(0, 60).map((w) => `<div class="error-row"><span class="en">${esc(w.en)}</span><span class="zh">${esc(w.zh || "")}</span>${w.retired ? '<span class="tag">\u7B80\u5355</span>' : "<span></span>"}</div>`).join("");
    return `<details class="error-book"><summary><b>${esc(book)}</b><span class="small">${words.length} \u8BCD</span></summary><div class="error-compact">${preview || '<div class="empty">\u6682\u65E0\u5355\u8BCD</div>'}</div>${words.length > 60 ? `<div class="small" style="padding:8px 0">\u8FD9\u91CC\u53EA\u9884\u89C8\u524D 60 \u4E2A\uFF1B\u70B9\u4E0B\u9762\u67E5\u770B\u5168\u90E8\u3002</div>` : ""}<div class="row" style="padding:9px 0"><button class="soft" data-open-error-book="${esc(book)}">\u5728\u8BCD\u5E93\u4E2D\u67E5\u770B\u5168\u90E8</button></div></details>`;
  }).join("")}</div></section>`;
}
function renderHome() {
  const today = todayListeningStats(state, [], currentDayKey());
  shell(`<div class="stack"><section class="card hero"><div class="space"><div><h2>\u4ECA\u5929</h2><p>\u9996\u9875\u53EA\u7559\u4ECA\u65E5\u5B8C\u6210\u5C0F\u8BA1\u548C\u5165\u53E3\u3002</p></div><button id="goToday" class="primary">\u8FDB\u5165\u4ECA\u65E5\u5B66\u4E60</button></div><div class="grid2" style="margin-top:16px"><div class="statbox"><b>${today.newCount}</b><span>\u4ECA\u65E5\u65B0\u8BCD\u5B8C\u6210</span></div><div class="statbox"><b>${today.reviewCount}</b><span>\u4ECA\u65E5\u590D\u4E60\u5B8C\u6210</span></div></div></section><div class="grid2"><button id="homeToday" class="entry"><b>\u4ECA\u65E5\u5B66\u4E60</b><span>\u7EE7\u7EED\u65B0\u8BCD\u3001\u590D\u4E60\u548C\u5F53\u5929\u5F85\u5DE9\u56FA\u3002</span></button><button id="goType" class="entry"><b>\u624B\u6253\u5F3A\u5316</b><span>\u6309\u65E5\u671F\u3001\u8BCD\u4E66\u548C\u4E0D\u719F\u6B21\u6570\u7B5B\u9009\u5F3A\u5316\u3002</span></button><button id="goText" class="entry"><b>\u6587\u672C\u4E0E\u53E5\u5B50</b><span>\u6587\u672C\u5E93\u3001\u53E5\u5B50\u62C6\u8BCD\u542C\u5199\u548C\u53E5\u5B50\u9519\u8BCD\u3002</span></button><button id="goStats" class="entry"><b>\u5B66\u4E60\u7EDF\u8BA1</b><span>\u65E5\u5386\u3001\u9996\u8F6E\u7ED3\u679C\u3001\u56F0\u96BE\u8BCD\u548C\u590D\u4E60\u9884\u6D4B\u3002</span></button></div></div>`);
  document.getElementById("goToday").onclick = () => go("today");
  document.getElementById("homeToday").onclick = () => go("today");
  document.getElementById("goType").onclick = () => go("type");
  document.getElementById("goText").onclick = () => go("text");
  document.getElementById("goStats").onclick = () => go("stats");
}
function renderToday() {
  const date = currentDayKey();
  const books = state.settings.todayBooks || [];
  let plan = ensureDailyPlan(state, planForTodayOptions(date, books));
  if (plan.mode === "sequential") {
    const existing = new Map((plan.bookSegments || []).map((x) => [x.book, x]));
    const chosen = books.map((book) => ({ book, newTarget: existing.get(book)?.newTarget ?? 0, reviewTarget: existing.get(book)?.reviewTarget ?? 0 }));
    configureSequentialPlan(state, plan, chosen);
  }
  persist();
  const prog = sessionProgress(state, plan, null);
  const td = todayListeningStats(state, books, date);
  const mins = activityMinutes("listen", date);
  const selectedText = books.length ? books.join("\u3001") : "\u5168\u90E8\u8BCD\u4E66";
  const currentSeg = currentSequentialSegment(state, plan);
  const sequentialRows = plan.mode === "sequential" ? (plan.bookSegments || []).map((seg, i) => {
    const st = segmentStatus(state, plan, seg);
    const nd = st.new.done, rd = st.review.done;
    const newShort = seg.newIds.length < seg.newTarget ? ` \xB7 \u53EF\u5206\u914D ${seg.newIds.length}` : "";
    const reviewShort = seg.reviewIds.length < seg.reviewTarget ? ` \xB7 \u53EF\u5206\u914D ${seg.reviewIds.length}` : "";
    return `<div class="bookrow" style="grid-template-columns:minmax(90px,1.4fr) 1fr 1fr"><b>${i + 1}. ${esc(seg.book)}${currentSeg?.book === seg.book ? " \xB7 \u5F53\u524D" : ""}</b><label class="small">\u65B0\u8BCD <input data-seq-new="${i}" type="number" min="0" value="${seg.newTarget}" style="width:78px"> <span>${nd}/${seg.newIds.length}${newShort}</span></label><label class="small">\u590D\u4E60 <input data-seq-review="${i}" type="number" min="0" value="${seg.reviewTarget}" style="width:78px"> <span>${rd}/${seg.reviewIds.length}${reviewShort}</span></label></div>`;
  }).join("") : "";
  const bookRows = plan.mode === "sequential" ? (plan.bookSegments || []).map((seg) => {
    const x = segmentStatus(state, plan, seg);
    return `<div class="bookrow"><b>${esc(seg.book)}</b><span>${x.new.done}/${seg.newIds.length} \u65B0</span><span>${x.review.done}/${seg.reviewIds.length} \u590D\u4E60</span><span class="mobilehide">\u672C\u8F6E\u5B9E\u9645\u5F52\u5C5E</span><span class="mobilehide">\u53BB\u91CD\u540E\u7EDF\u8BA1</span></div>`;
  }).join("") : (books.length ? books : allBooks(state)).map((b) => {
    const x = todayListeningStats(state, [b], date);
    return `<div class="bookrow"><b>${esc(b)}</b><span>${x.newCount} \u65B0</span><span>${x.reviewCount} \u590D\u4E60</span><span class="mobilehide good">${x.firstGood} \u719F\u6089</span><span class="mobilehide bad">${x.firstBad} \u4E0D\u719F</span></div>`;
  }).join("");
  const bookStatsNote = plan.mode === "sequential" ? "\u5206\u672C\u4F9D\u6B21\u6309\u4ECA\u65E5\u4EFB\u52A1\u7684\u5B9E\u9645\u5F52\u5C5E\u7EDF\u8BA1\uFF0C\u5171\u4EAB\u8BCD\u53EA\u7B97\u5728\u524D\u9762\u7B2C\u4E00\u672C\u3002" : "\u6DF7\u5408\u6A21\u5F0F\u6309\u8BCD\u4E66\u6765\u6E90\u5206\u522B\u7EDF\u8BA1\uFF1B\u540C\u4E00\u4E2A\u5171\u4EAB\u8BCD\u53EF\u80FD\u540C\u65F6\u51FA\u73B0\u5728\u591A\u672C\u8BCD\u4E66\uFF0C\u56E0\u6B64\u5404\u884C\u4E0D\u8981\u76F4\u63A5\u76F8\u52A0\u3002";
  const planControls = plan.mode === "sequential" ? `<div class="small" style="margin:10px 0">\u6309\u4E0B\u9762\u987A\u5E8F\u4E00\u672C\u4E00\u672C\u5B66\u5B8C\u3002\u91CD\u590D\u8BCD\u53EA\u5F52\u524D\u9762\u7B2C\u4E00\u672C\uFF0C\u4E0D\u4F1A\u91CD\u590D\u5360\u540D\u989D\u3002</div>${sequentialRows || '<div class="empty">\u5148\u9009\u62E9\u81F3\u5C11\u4E00\u672C\u5177\u4F53\u8BCD\u4E66\u3002</div>'}` : `<div class="grid2" style="margin-top:12px"><div class="field"><label>\u4ECA\u5929\u65B0\u8BCD\u76EE\u6807</label><input id="todayNewTarget" type="number" min="0" value="${plan.newTarget}"></div><div class="field"><label>\u4ECA\u5929\u590D\u4E60\u76EE\u6807</label><input id="todayReviewTarget" type="number" min="0" value="${plan.reviewTarget}"></div></div>`;
  shell(`<div class="stack"><section class="card hero"><div class="space"><div><h2>\u4ECA\u5929\u5148\u5B8C\u6210\u8FD9\u4E00\u7EC4</h2><div class="small">${esc(selectedText)} \xB7 ${studyDayLabel()}</div></div><span class="tag">${plan.mode === "sequential" ? "\u5206\u672C\u4F9D\u6B21" : "\u6DF7\u5408"} \xB7 FSRS</span></div><div class="plan" style="margin-top:15px"><div class="statbox"><b>${prog.newDone} / ${prog.newTotal}</b><span>\u65B0\u8BCD</span><div class="progressline"><i style="width:${prog.newTotal ? prog.newDone * 100 / prog.newTotal : 0}%"></i></div></div><div class="statbox"><b>${prog.reviewDone} / ${prog.reviewTotal}</b><span>\u590D\u4E60</span><div class="progressline"><i style="width:${prog.reviewTotal ? prog.reviewDone * 100 / prog.reviewTotal : 0}%"></i></div></div><div class="statbox"><b class="${prog.retry ? "bad" : ""}">${prog.retry}</b><span>\u5F85\u5DE9\u56FA</span><div class="small">\u4E0D\u589E\u52A0\u65B0\u8BCD/\u590D\u4E60\u5206\u6BCD</div></div></div>${currentSeg ? `<div class="small" style="margin-top:10px">\u5F53\u524D\u8BCD\u4E66\uFF1A<b>${esc(currentSeg.book)}</b>\uFF0C\u5B8C\u6210\u540E\u81EA\u52A8\u7EE7\u7EED\u4E0B\u4E00\u672C\u3002</div>` : ""}<div class="row" style="margin-top:16px"><button id="startListen" class="primary">${prog.remaining ? "\u7EE7\u7EED\u4ECA\u65E5\u542C\u97F3" : "\u4ECA\u65E5\u5DF2\u5B8C\u6210"}</button><span class="small">\u542C\u97F3 ${mins} \u5206\u949F \xB7 \u9996\u8F6E\u719F\u6089 ${pct(td.firstGood, td.firstGood + td.firstBad)}</span></div><details class="details"><summary>\u672C\u8F6E\u5355\u8BCD\u6E05\u5355 \xB7 ${prog.newTotal + prog.reviewTotal}</summary><div style="margin-top:10px">${planChecklistHtml(plan)}</div></details><details class="details"><summary>\u8C03\u6574\u4ECA\u5929\u7684\u8BA1\u5212\u4E0E\u8BCD\u4E66</summary><div style="margin-top:12px"><div class="field"><label>\u5B66\u4E60\u65B9\u5F0F</label><select id="todayPlanMode"><option value="mixed" ${plan.mode === "mixed" ? "selected" : ""}>\u6DF7\u5408\u5B66\u4E60\uFF1A\u591A\u672C\u8BCD\u4E66\u5171\u7528\u4E00\u4E2A\u603B\u91CF</option><option value="sequential" ${plan.mode === "sequential" ? "selected" : ""}>\u5206\u672C\u4F9D\u6B21\uFF1A\u4E00\u672C\u5B66\u5B8C\u518D\u4E0B\u4E00\u672C</option></select></div><div class="small" style="margin:10px 0">\u964D\u4F4E\u76EE\u6807\u65F6\u53EA\u88C1\u6389\u5B8C\u5168\u6CA1\u78B0\u8FC7\u7684\u8BCD\uFF1B\u5DF2\u7ECF\u542C\u8FC7\u7684\u8BCD\u4E0D\u4F1A\u88AB\u5220\u9664\u3002</div>${bookChips(books, "today")}${planControls}</div></details><details class="details"><summary>\u4EE5\u540E\u6BCF\u5929\u7684\u9ED8\u8BA4\u76EE\u6807</summary><div class="grid2" style="margin-top:12px"><div class="field"><label>\u4EE5\u540E\u9ED8\u8BA4\u65B0\u8BCD</label><input id="defaultNewTarget" type="number" min="0" value="${state.settings.defaultNewTarget}"></div><div class="field"><label>\u4EE5\u540E\u9ED8\u8BA4\u590D\u4E60</label><input id="defaultReviewTarget" type="number" min="0" value="${state.settings.defaultReviewTarget}"></div></div><div class="small" style="margin-top:8px">\u53EA\u5F71\u54CD\u4E4B\u540E\u65B0\u751F\u6210\u7684\u6DF7\u5408\u8BA1\u5212\uFF1B\u5206\u672C\u6A21\u5F0F\u6BCF\u672C\u5355\u72EC\u8BBE\u7F6E\u3002</div></details></section><section class="card"><h2 class="section-title">\u4ECA\u65E5\u542C\u97F3\u6570\u636E</h2><div class="grid4" style="margin-top:13px"><div class="statbox"><b>${td.newCount}</b><span>\u542C\u97F3\u65B0\u8BCD</span></div><div class="statbox"><b>${td.reviewCount}</b><span>\u542C\u97F3\u590D\u4E60</span></div><div class="statbox"><b class="good">${td.firstGood}</b><span>\u9996\u8F6E\u719F\u6089</span></div><div class="statbox"><b class="bad">${td.firstBad}</b><span>\u9996\u8F6E\u4E0D\u719F</span></div></div></section><section class="card"><h2 class="section-title">\u5404\u8BCD\u4E66\u4ECA\u5929\u7684\u60C5\u51B5</h2><div class="small">\u53EA\u7EDF\u8BA1\u542C\u97F3\uFF0C\u4E0D\u6DF7\u5165\u624B\u6253\u3002${bookStatsNote}</div><div style="margin-top:8px">${bookRows || '<div class="empty">\u8FD8\u6CA1\u6709\u8BCD\u4E66\u3002</div>'}</div></section></div>`);
  bindBookChips("today", () => {
    if (plan.mode === "sequential") {
      const existing = new Map((plan.bookSegments || []).map((x) => [x.book, x]));
      configureSequentialPlan(state, plan, (state.settings.todayBooks || []).map((book) => ({ book, newTarget: existing.get(book)?.newTarget ?? 0, reviewTarget: existing.get(book)?.reviewTarget ?? 0 })));
      persist();
    }
    renderToday();
  });
  document.getElementById("todayPlanMode").onchange = (e) => {
    if (e.target.value === "sequential") {
      if (!books.length) {
        toast("\u5206\u672C\u4F9D\u6B21\u5B66\u4E60\u9700\u8981\u5148\u9009\u5177\u4F53\u8BCD\u4E66");
        e.target.value = "mixed";
        return;
      }
      state.settings.todayPlanMode = "sequential";
      configureSequentialPlan(state, plan, books.map((book) => ({ book, newTarget: 0, reviewTarget: 0 })));
    } else {
      state.settings.todayPlanMode = "mixed";
      convertPlanToMixed(state, plan, books);
    }
    persist();
    renderToday();
  };
  if (plan.mode === "mixed") {
    document.getElementById("todayNewTarget").onchange = (e) => {
      const requested = Math.max(0, Number(e.target.value) || 0);
      const updated = ensureDailyPlan(state, { date, newTarget: requested });
      persist();
      if (updated.newTarget !== requested) toast(`\u4ECA\u5929\u5DF2\u7ECF\u505A\u8FC7 ${updated.newTarget} \u4E2A\u65B0\u8BCD\uFF0C\u76EE\u6807\u4E0D\u80FD\u518D\u964D`);
      renderToday();
    };
    document.getElementById("todayReviewTarget").onchange = (e) => {
      const requested = Math.max(0, Number(e.target.value) || 0);
      const updated = ensureDailyPlan(state, { date, reviewTarget: requested });
      persist();
      if (updated.reviewTarget !== requested) toast(`\u4ECA\u5929\u5DF2\u7ECF\u505A\u8FC7 ${updated.reviewTarget} \u4E2A\u590D\u4E60\u8BCD\uFF0C\u76EE\u6807\u4E0D\u80FD\u518D\u964D`);
      renderToday();
    };
  } else {
    const saveSegments = () => {
      const configs = (plan.bookSegments || []).map((seg, i) => ({ book: seg.book, newTarget: Math.max(0, Number(document.querySelector(`[data-seq-new="${i}"]`)?.value) || 0), reviewTarget: Math.max(0, Number(document.querySelector(`[data-seq-review="${i}"]`)?.value) || 0) }));
      configureSequentialPlan(state, plan, configs);
      persist();
      renderToday();
    };
    document.querySelectorAll("[data-seq-new],[data-seq-review]").forEach((el) => el.onchange = saveSegments);
  }
  document.getElementById("defaultNewTarget").onchange = (e) => {
    state.settings.defaultNewTarget = Math.max(0, Number(e.target.value) || 0);
    persist();
    toast("\u5DF2\u4FEE\u6539\u4EE5\u540E\u6BCF\u5929\u7684\u65B0\u8BCD\u9ED8\u8BA4\u503C");
  };
  document.getElementById("defaultReviewTarget").onchange = (e) => {
    state.settings.defaultReviewTarget = Math.max(0, Number(e.target.value) || 0);
    persist();
    toast("\u5DF2\u4FEE\u6539\u4EE5\u540E\u6BCF\u5929\u7684\u590D\u4E60\u9ED8\u8BA4\u503C");
  };
  document.getElementById("startListen").onclick = () => {
    if (!prog.remaining) return toast("\u4ECA\u5929\u8FD9\u4E00\u7EC4\u5DF2\u7ECF\u5B8C\u6210");
    startListen(plan);
  };
}
function planForTodayOptions(date, books) {
  const existing = state.dailyPlans[date];
  if (existing?.mode === "sequential") return { date };
  return { date, books };
}
function makeListenPlan(plan) {
  if (plan.mode !== "sequential") return plan;
  const segment = currentSequentialSegment(state, plan);
  if (!segment) return null;
  return { ...plan, newIds: [...segment.newIds], reviewIds: [...segment.reviewIds], resumeWordId: plan.resumeWordId, segmentBook: segment.book };
}
function startListen(plan, activityId = null) {
  const sessionPlan = makeListenPlan(plan);
  if (!sessionPlan) return toast("\u4ECA\u5929\u8FD9\u4E00\u7EC4\u5DF2\u7ECF\u5B8C\u6210");
  const session = createRetrySession(state, sessionPlan, "listen");
  const id3 = pickNext(session);
  if (!id3) return toast("\u5F53\u524D\u8BCD\u4E66\u5DF2\u7ECF\u5B8C\u6210");
  plan.resumeWordId = id3;
  persist();
  listen = { plan, sessionPlan, session, currentEventId: null, result: null, answer: false, showList: false, activityId: activityId || startActivity("listen", "\u4ECA\u65E5\u542C\u97F3", plan.books), historyView: null, segmentBook: sessionPlan.segmentBook || null };
  renderListen();
  speak(wordById(id3).en);
}
function listenCurrentWord() {
  const id3 = listen?.historyView?.wordId || listen?.session.current?.wordId;
  return wordById(id3);
}
function renderListen() {
  const w = listenCurrentWord();
  if (!w) {
    listen = null;
    view = "today";
    renderToday();
    return;
  }
  if (!listen.historyView && listen.session.current?.source === "buffer") {
    const gap = nextRetryGap(listen.session);
    root.innerHTML = `<main class="immersive"><div class="studytop"><button id="listenBack" class="back">\u2039</button><div class="studyprogress">\u95F4\u9694\u8BCD \xB7 \u4E0D\u8BA1\u5B66\u4E60\u8BB0\u5F55</div></div><div class="studybody"><div class="small">\u961F\u5C3E\u5F85\u5DE9\u56FA\u8BCD\u8FD8\u5DEE\u7EA6 ${gap} \u4E2A\u5176\u4ED6\u8BCD\uFF1B\u8FD9\u5F20\u53EA\u8D1F\u8D23\u62C9\u5F00\u95F4\u9694\uFF0C\u4E0D\u6539 FSRS\u3001\u4E0D\u6539 3/3\u3002</div><button id="speakWord" class="speaker">\u25D6))</button><div class="word">${esc(w.en)}</div><div class="meaning">${esc(w.zh || "")}</div><button id="bufferNext" class="primary" style="margin-top:18px">\u7EE7\u7EED</button></div></main>`;
    document.getElementById("listenBack").onclick = () => {
      touchActivity(listen.activityId);
      listen = null;
      view = "today";
      renderToday();
    };
    document.getElementById("speakWord").onclick = () => speak(w.en);
    document.getElementById("bufferNext").onclick = () => {
      finishCurrent(listen.session, "buffer");
      touchActivity(listen.activityId);
      advanceListen();
    };
    return;
  }
  const p = sessionProgress(state, listen.plan, listen.session);
  const reviewing = Boolean(listen.historyView);
  const result = reviewing ? listen.historyView.result : listen.result;
  const answer = reviewing || listen.answer;
  const currentId = w.id;
  root.innerHTML = `<main class="immersive"><div class="studytop"><button id="listenBack" class="back">\u2039</button><div class="studyprogress">${listen.segmentBook ? `${esc(listen.segmentBook)} \xB7 ` : ""}\u65B0\u8BCD ${p.newDone} / ${p.newTotal}\u3000\u590D\u4E60 ${p.reviewDone} / ${p.reviewTotal}${p.retry ? `\u3000\u5F85\u5DE9\u56FA ${p.retry}` : ""}</div><div class="study-actions"><button id="studyListButton">${listen.showList ? "\u6536\u8D77\u6E05\u5355" : "\u672C\u8F6E\u6E05\u5355"}</button>${!reviewing ? '<button id="retireWord">\u6807\u8BB0\u7B80\u5355</button>' : ""}</div></div>${listen.showList ? `<section class="study-sheet"><div class="study-sheet-head"><div><b>\u672C\u8F6E\u5355\u8BCD</b><div class="small">\u65B0\u8BCD\u3001\u590D\u4E60\u548C\u6BCF\u4E2A\u8BCD\u5F53\u524D\u6807\u8BB0</div></div><button id="closeStudyList" class="soft">\u5173\u95ED</button></div>${planChecklistHtml(listen.plan, currentId)}</section>` : ""}<div class="studybody"><div class="type-kind">${planWordKind(listen.plan, w.id)}${planWordBook(listen.plan, w.id) ? ` \xB7 ${esc(planWordBook(listen.plan, w.id))}` : ""}</div><button id="speakWord" class="speaker">\u25D6))</button>${answer ? `<div class="word ${result === "good" ? "good" : result === "bad" ? "bad" : ""}">${esc(w.en)}</div><div class="meaning">${esc(w.zh || "\u6682\u65E0\u4E2D\u6587\u91CA\u4E49")}</div>${w.pos || w.def ? `<div class="meta">${esc(w.pos)}${w.def ? ` \xB7 ${esc(w.def)}` : ""}</div>` : ""}${w.examples?.length ? `<div class="example">${esc(w.examples[w.examples.length - 1])}</div>` : ""}<div class="source-tags">${(w.sources || []).map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div>` : '<div class="small">\u542C\u5230\u4EE5\u540E\uFF0C\u610F\u601D\u80FD\u4E0D\u80FD\u76F4\u63A5\u51FA\u6765\uFF1F</div>'}<div class="judges"><button id="judgeGood" class="goodbtn">1\u3000\u719F\u6089</button><button id="judgeBad" class="badbtn">2\u3000\u4E0D\u719F\u6089</button></div>${answer ? `<div class="move"><button id="prevWord" class="soft" ${listen.session.history.length ? "" : "disabled"}>\u4E0A\u4E00\u8BCD</button><button id="nextWord" class="primary">${reviewing ? "\u56DE\u5230\u5F53\u524D\u8BCD" : "\u4E0B\u4E00\u8BCD"}</button></div>` : ""}<div class="statusline">${reviewing ? "\u4FEE\u6539\u5386\u53F2\u5224\u65AD\u540E\u4F1A\u91CD\u65B0\u8BA1\u7B97\u5F53\u5929\u961F\u5217\u548C FSRS \u72B6\u6001\u3002" : "\u53EA\u64AD\u653E\u4F46\u6CA1\u5224\u65AD\u7684\u8BCD\u4E0D\u4EA7\u751F\u5B66\u4E60\u8BB0\u5F55\uFF1B\u9000\u51FA\u540E\u4F1A\u5C3D\u91CF\u4ECE\u5B83\u7EE7\u7EED\u3002"}</div></div></main>`;
  document.getElementById("listenBack").onclick = () => {
    touchActivity(listen.activityId);
    persist();
    listen = null;
    view = "today";
    renderToday();
  };
  document.getElementById("studyListButton").onclick = () => {
    listen.showList = !listen.showList;
    renderListen();
  };
  if (document.getElementById("closeStudyList")) document.getElementById("closeStudyList").onclick = () => {
    listen.showList = false;
    renderListen();
  };
  document.getElementById("speakWord").onclick = () => {
    speak(w.en);
    if (!reviewing) touchActivity(listen.activityId);
  };
  if (!reviewing) document.getElementById("retireWord").onclick = () => {
    markSimpleLexeme(state, w.en, true);
    persist();
    finishCurrent(listen.session, "good", state);
    listen.currentEventId = null;
    listen.result = null;
    listen.answer = false;
    advanceListen();
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
    resyncRetryForWord(listen.session, state, w.id, listen.plan.date, "listen");
    persist();
    renderListen();
    return;
  }
  if (!listen.currentEventId) {
    const ev = recordAttempt(state, w, "listen", result, { date: listen.plan.date });
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
  finishCurrent(listen.session, listen.result, state);
  listen.currentEventId = null;
  listen.result = null;
  listen.answer = false;
  touchActivity(listen.activityId);
  advanceListen();
}
function advanceListen() {
  let id3 = pickNext(listen.session);
  if (id3) {
    listen.plan.resumeWordId = id3;
    persist();
    renderListen();
    speak(wordById(id3).en);
    return;
  }
  if (listen.plan.mode === "sequential" && currentSequentialSegment(state, listen.plan)) {
    const activityId = listen.activityId;
    const plan = listen.plan;
    listen = null;
    startListen(plan, activityId);
    return;
  }
  listen.plan.resumeWordId = null;
  persist();
  const p = sessionProgress(state, listen.plan, listen.session);
  root.innerHTML = `<main class="immersive"><div class="studybody"><div class="finish"><div class="small">\u672C\u8F6E\u5B8C\u6210</div><h2>\u4ECA\u65E5\u542C\u97F3\u5B8C\u6210</h2><div class="grid3" style="margin:18px 0"><div class="statbox"><b>${p.newDone}/${p.newTotal}</b><span>\u65B0\u8BCD</span></div><div class="statbox"><b>${p.reviewDone}/${p.reviewTotal}</b><span>\u590D\u4E60</span></div><div class="statbox"><b>${p.retry}</b><span>\u5F85\u5DE9\u56FA</span></div></div><button id="finishListen" class="primary">\u56DE\u5230\u4ECA\u65E5</button></div></div></main>`;
  document.getElementById("finishListen").onclick = () => {
    listen = null;
    view = "today";
    renderToday();
  };
}
function showPreviousListen() {
  const h = listen.session.history[listen.session.history.length - 1];
  if (!h?.eventId) return;
  listen.historyView = { wordId: h.wordId, eventId: h.eventId, result: state.events.find((e) => e.id === h.eventId)?.result || h.result };
  renderListen();
}
function returnFromHistory() {
  listen.historyView = null;
  renderListen();
}
function typeCandidates() {
  const books = state.settings.typeBooks || [];
  return state.words.filter((w) => !w.retired && matchesBooks(w, books));
}
function typePreset(kind) {
  const candidates = typeCandidates();
  const today = currentDayKey();
  return typePresetIds(state, candidates, kind, today, state.dailyPlans?.[today] || null);
}
function renderType() {
  const books = state.settings.typeBooks || [];
  const auto = typePreset("auto"), n = typePreset("todayNew"), rv = typePreset("todayReview"), l = typePreset("todayListen"), t = typePreset("todayType"), r = typePreset("repeat7");
  const typedToday = new Set(state.events.filter((e) => e.date === currentDayKey() && e.mode === "type").map((e) => e.wordId)).size;
  shell(`<div class="stack"><section class="card hero"><div class="space"><div><h2>\u624B\u6253\u5F3A\u5316</h2><p>\u65B0\u8BCD\u548C\u590D\u4E60\u8BCD\u5206\u5F00\u770B\uFF1B\u53EA\u628A\u4ECA\u5929\u5DF2\u7ECF\u542C\u8FC7\u7684\u8BCD\u653E\u8FDB\u201C\u4ECA\u65E5\u65B0\u8BCD/\u590D\u4E60\u201D\uFF0C\u4E0D\u4F1A\u63D0\u524D\u6CC4\u9732\u8FD8\u6CA1\u51B7\u542F\u52A8\u7684\u65B0\u8BCD\u3002</p></div><span class="tag">${books.length ? `${books.length} \u672C\u8BCD\u4E66` : "\u5168\u90E8\u8BCD\u4E66"}</span></div><div class="grid4" style="margin-top:13px"><div class="statbox"><b>${n.length}</b><span>\u4ECA\u65E5\u65B0\u8BCD\u53EF\u624B\u6253</span></div><div class="statbox"><b>${rv.length}</b><span>\u4ECA\u65E5\u590D\u4E60\u53EF\u624B\u6253</span></div><div class="statbox"><b>${auto.length}</b><span>\u5EFA\u8BAE\u5F3A\u5316</span></div><div class="statbox"><b>${typedToday}</b><span>\u4ECA\u65E5\u5DF2\u624B\u6253</span></div></div><div class="small" style="margin-top:9px">\u624B\u6253\u7528\u65F6 ${activityMinutes("type")} \u5206\u949F</div><div class="row" style="margin-top:15px"><button id="typeStartAuto" class="primary">\u5F00\u59CB\u5EFA\u8BAE\u5F3A\u5316${auto.length ? ` \xB7 ${Math.min(30, auto.length)}` : ""}</button></div><details class="details"><summary>\u8BCD\u4E66\u8303\u56F4\u4E0E\u9AD8\u7EA7\u7B5B\u9009</summary><div style="margin-top:12px">${bookChips(books, "type")}<div class="filtergrid" style="margin-top:12px"><div class="field"><label>\u6307\u5B9A\u65E5\u671F</label><input id="typeDate" type="date" value="${currentDayKey()}"></div><div class="field"><label>\u5931\u8D25\u6765\u6E90</label><select id="typeMode"><option value="all">\u542C\u97F3 + \u624B\u6253</option><option value="listen">\u53EA\u770B\u542C\u97F3</option><option value="type">\u53EA\u770B\u624B\u6253</option></select></div><div class="field"><label>\u81F3\u5C11\u4E0D\u719F\u6B21\u6570</label><select id="typeMin"><option>1</option><option>2</option><option>3</option><option>5</option></select></div><div class="field"><label>\u672C\u8F6E\u6570\u91CF</label><select id="typeLimit"><option>20</option><option selected>50</option><option>100</option><option value="0">\u5168\u90E8</option></select></div></div><div id="customTypePreview" style="margin-top:12px"></div></div></details></section><section class="card"><h2 class="section-title">\u6309\u65B0\u8BCD / \u590D\u4E60\u8FDB\u5165</h2><div class="quick" style="margin-top:12px"><button data-type-preset="todayNew"><span class="num">${n.length}</span><b>\u4ECA\u65E5\u65B0\u8BCD</b><span class="small">\u4ECA\u5929\u5DF2\u7ECF\u542C\u8FC7\u7684\u65B0\u8BCD</span></button><button data-type-preset="todayReview"><span class="num">${rv.length}</span><b>\u4ECA\u65E5\u590D\u4E60\u8BCD</b><span class="small">\u4ECA\u5929\u5DF2\u7ECF\u542C\u8FC7\u7684\u590D\u4E60\u8BCD</span></button></div></section><section class="card"><h2 class="section-title">\u56F0\u96BE\u8BCD\u5FEB\u6377\u5165\u53E3</h2><div class="quick" style="margin-top:12px"><button data-type-preset="todayListen"><span class="num">${l.length}</span><b>\u4ECA\u65E5\u542C\u97F3\u4E0D\u719F</b><span class="small">\u4ECA\u5929\u542C\u97F3\u9636\u6BB5\u66B4\u9732\u51FA\u6765\u7684\u8BCD</span></button><button data-type-preset="todayType"><span class="num">${t.length}</span><b>\u4ECA\u65E5\u624B\u6253\u4E0D\u719F</b><span class="small">\u4ECA\u5929\u624B\u6253\u540E\u4ECD\u7136\u5361\u4F4F</span></button><button data-type-preset="repeat7"><span class="num">${r.length}</span><b>\u8FD1 7 \u5929\u53CD\u590D\u4E0D\u719F</b><span class="small">\u8FD1\u671F\u91CD\u590D\u5931\u8D25\u7684\u8BCD</span></button><button data-type-preset="auto"><span class="num">${auto.length}</span><b>\u5168\u90E8\u56F0\u96BE\u8BCD</b><span class="small">\u6309\u8DE8\u5929\u5931\u8D25\u4E0E\u53EF\u63D0\u53D6\u7387\u6392\u5E8F</span></button></div></section></div>`);
  bindBookChips("type", renderType);
  document.getElementById("typeStartAuto").onclick = () => startType(auto.slice(0, 30), "\u5EFA\u8BAE\u5F3A\u5316");
  document.querySelectorAll("[data-type-preset]").forEach((b) => b.onclick = () => startType(typePreset(b.dataset.typePreset).slice(0, 50), b.dataset.typePreset === "todayNew" ? "\u4ECA\u65E5\u65B0\u8BCD" : b.dataset.typePreset === "todayReview" ? "\u4ECA\u65E5\u590D\u4E60\u8BCD" : b.textContent.trim().replace(/\d+/, "").slice(0, 20)));
  const inputs = ["typeDate", "typeMode", "typeMin", "typeLimit"];
  inputs.forEach((id3) => document.getElementById(id3).onchange = renderTypeCustom);
  renderTypeCustom();
}
function customTypeIds() {
  const date = document.getElementById("typeDate")?.value || currentDayKey();
  const mode = document.getElementById("typeMode")?.value || "all";
  const min = Number(document.getElementById("typeMin")?.value || 1);
  const allowed = new Set(typeCandidates().map((w) => w.id));
  return customTypeIdsFromEvents(state.events, allowed, { date, mode, min });
}
function renderTypeCustom() {
  const box = document.getElementById("customTypePreview");
  if (!box) return;
  const ids = customTypeIds();
  const limit = Number(document.getElementById("typeLimit")?.value || 50);
  const q = limit ? ids.slice(0, limit) : ids;
  box.innerHTML = `<div class="space"><div><b>${ids.length} \u4E2A\u8BCD\u5339\u914D</b><div class="small">${q.slice(0, 8).map((id3) => esc(wordById(id3)?.en)).join(" \xB7 ")}</div></div><button id="startCustomType" class="soft" ${q.length ? "" : "disabled"}>\u5F00\u59CB\u8FD9\u7EC4${q.length ? ` \xB7 ${q.length}` : ""}</button></div>`;
  document.getElementById("startCustomType").onclick = () => startType(q, "\u81EA\u5B9A\u4E49\u5F3A\u5316");
}
function startType(ids, label) {
  ids = [...new Set(ids)].filter((id4) => wordById(id4) && !wordById(id4).retired);
  if (!ids.length) return toast("\u8FD9\u7EC4\u6682\u65F6\u6CA1\u6709\u5F85\u5F3A\u5316\u8BCD");
  const fakePlan = { date: currentDayKey(), newIds: ids, reviewIds: [] };
  const session = createRetrySession(state, fakePlan, "type", ids);
  const id3 = pickNext(session);
  if (!id3) return toast("\u8FD9\u4E9B\u8BCD\u4ECA\u5929\u5DF2\u7ECF\u624B\u6253\u719F\u6089\u4E86");
  typeRun = { ids, label, session, answer: false, input: "", currentEventId: null, result: null, skipped: 0, activityId: startActivity("type", label, state.settings.typeBooks || []) };
  renderTypeRun();
  speak(wordById(id3).en);
}
function typeProgress() {
  const states = typeRun.ids.map((id3) => reinforcementState(eventsOnDay(state, id3, currentDayKey(), "type")));
  const done = states.filter((x) => x.passed).length;
  const bad = states.filter((x) => x.started && !x.passed).length;
  return { done, total: typeRun.ids.length, bad };
}
function renderTypeRun() {
  const id3 = typeRun.session.current?.wordId;
  const w = wordById(id3);
  if (!w) return finishType();
  const p = typeProgress();
  const kind = typeWordKind(id3);
  if (typeRun.session.current?.source === "buffer") {
    const gap = nextRetryGap(typeRun.session);
    root.innerHTML = `<main class="immersive"><div class="studytop"><button id="typeBack" class="back">\u2039</button><div class="studyprogress">\u95F4\u9694\u8BCD \xB7 \u624B\u6253\u4E0D\u8BA1\u5206</div></div><div class="studybody"><div class="small">\u4E3A\u4E86\u62C9\u5F00 3/3 \u7684\u8BCD\u95F4\u8DDD\u4E34\u65F6\u7A7F\u63D2\uFF1B\u8FD8\u5DEE\u7EA6 ${gap} \u4E2A\u5176\u4ED6\u8BCD\u3002</div><button id="typeSpeak" class="speaker">\u25D6))</button><div class="word">${esc(w.en)}</div><div class="meaning">${esc(w.zh || "")}</div><button id="typeBufferNext" class="primary" style="margin-top:18px">\u7EE7\u7EED</button></div></main>`;
    document.getElementById("typeBack").onclick = () => {
      typeRun = null;
      view = "type";
      renderType();
    };
    document.getElementById("typeSpeak").onclick = () => speak(w.en);
    document.getElementById("typeBufferNext").onclick = () => {
      finishCurrent(typeRun.session, "buffer");
      if (!pickNext(typeRun.session)) finishType();
      else {
        renderTypeRun();
        speak(wordById(typeRun.session.current.wordId).en);
      }
    };
    return;
  }
  root.innerHTML = `<main class="immersive"><div class="studytop"><button id="typeBack" class="back">\u2039</button><div class="studyprogress">${p.done} / ${p.total}${p.bad ? `\u3000\u5F85\u5DE9\u56FA ${p.bad}` : ""} \xB7 ${kind} \xB7 ${esc(typeRun.label)}</div></div><div class="studybody"><button id="typeSpeak" class="speaker">\u25D6))</button>${!typeRun.answer ? `<div class="small">\u542C\u97F3\u540E\u5199\u51FA\u4F60\u76F4\u63A5\u60F3\u5230\u7684\u4E2D\u6587\u6838\u5FC3\u610F\u601D\u3002</div><div style="width:100%;max-width:560px;margin-top:18px"><input id="typeAnswer" style="font-size:21px;text-align:center" placeholder="\u5199\u4E2D\u6587\u6838\u5FC3\u610F\u601D\u2026" autocomplete="off"><div class="grid2" style="margin-top:10px"><button id="typeSubmit" class="primary">\u63D0\u4EA4</button><button id="typeReveal" class="soft">\u770B\u7B54\u6848</button></div></div>` : `<div class="word ${typeRun.result === "good" ? "good" : typeRun.result === "bad" ? "bad" : ""}">${esc(w.en)}</div><div class="meaning">${esc(w.zh || "\u6682\u65E0\u4E2D\u6587\u91CA\u4E49")}</div>${w.pos || w.def ? `<div class="meta">${esc(w.pos)}${w.def ? ` \xB7 ${esc(w.def)}` : ""}</div>` : ""}${w.examples?.length ? `<div class="example">${esc(w.examples[w.examples.length - 1])}</div>` : ""}<div class="source-tags">${(w.sources || []).map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div><div class="typed"><b>\u4F60\u521A\u624D\u5199\u7684\u662F</b><div>${esc(typeRun.input || "\uFF08\u76F4\u63A5\u770B\u4E86\u7B54\u6848\uFF09")}</div></div><div class="judges"><button id="typeGood" class="goodbtn">1\u3000\u719F\u6089</button><button id="typeBad" class="badbtn">2\u3000\u4E0D\u719F\u6089</button></div><div class="move"><button id="typeReplay" class="soft">\u91CD\u542C</button><button id="typeNext" class="primary" ${typeRun.result ? "" : "disabled"}>\u4E0B\u4E00\u8BCD</button></div><div class="statusline">\u4E0D\u81EA\u52A8\u5224\u4E2D\u6587\u540C\u4E49\u8BCD\u5BF9\u9519\uFF1B\u719F\u6089/\u4E0D\u719F\u6089\u4ECD\u7136\u4F5C\u7528\u4E8E\u540C\u4E00\u4E2A\u5355\u8BCD\u5386\u53F2\u3002</div>`}</div></main>`;
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
  finishCurrent(typeRun.session, typeRun.result, state);
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
  const bad = typeRun.ids.filter((id3) => {
    const r = reinforcementState(eventsOnDay(state, id3, currentDayKey(), "type"));
    return r.started && !r.passed;
  });
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
  return segmentTextSentences(body).map((row) => row.text);
}
function sentenceStateInfo(entry) {
  const status = deriveSentencePracticeStatus(entry);
  return { status, label: status === "repeat" ? "\u9700\u91CD\u7EC3" : status === "done" ? "\u5DF2\u901A\u8FC7" : status === "ignored" ? "\u5FFD\u7565" : "\u672A\u7EC3" };
}
function sentenceSourceBadge(entry) {
  const status = linkedSentenceSourceState(state, entry);
  const suffix = status === "source-deleted" ? " \xB7 \u6765\u6E90\u5DF2\u5220\u9664" : status === "source-changed" ? " \xB7 \u539F\u6587\u5DF2\u4FEE\u6539" : status === "legacy-link" ? " \xB7 \u65E7\u7248\u5173\u8054" : "";
  return `${esc(sentenceSourceLabel(entry))}${suffix ? `<span class="tag">${esc(suffix.trim().replace(/^·\s*/, ""))}</span>` : ""}`;
}
function sentenceLibraryBookHtml(book) {
  const rank = { repeat: 0, unseen: 1, done: 2, ignored: 3 };
  const entries = [...book.entries || []].sort((a, b) => rank[sentenceStateInfo(a).status] - rank[sentenceStateInfo(b).status] || Number(b.lastPracticedAt || b.updatedAt || 0) - Number(a.lastPracticedAt || a.updatedAt || 0));
  const repeat = entries.filter((e) => sentenceStateInfo(e).status === "repeat").length;
  return `<details class="sentence-book"><summary><b>${esc(book.name)}</b><span class="small">${entries.length} \u53E5${repeat ? ` \xB7 ${repeat} \u53E5\u9700\u91CD\u7EC3` : ""}</span></summary><div>${entries.map((entry) => {
    const st = sentenceStateInfo(entry);
    const problems = sentenceProblemTokens(entry).filter((token) => !isSimpleLexeme(state, token.normalized || token.surface));
    return `<div class="sentence-entry"><div class="sentence-entry-meta"><span class="sentence-state ${st.status}">${st.label}</span><span class="small">${sentenceSourceBadge(entry)}${problems.length ? ` \xB7 \u9519\u8BCD ${problems.length}` : ""}</span></div><div class="sentence-entry-text">${esc(entry.text)}</div><div class="sentence-mode-row"><button class="soft" data-whole-entry="${book.id}|${entry.id}">\u6574\u53E5\u542C\u5199</button><button class="soft" data-split-entry="${book.id}|${entry.id}">\u62C6\u8BCD\u542C\u5199</button>${problems.length ? `<button class="soft" data-problem-entry="${book.id}|${entry.id}">\u53EA\u7EC3\u9519\u8BCD</button>` : ""}<button class="ghost" data-ignore-entry="${book.id}|${entry.id}">${st.status === "ignored" ? "\u6062\u590D" : "\u5FFD\u7565"}</button></div></div>`;
  }).join("") || '<div class="empty">\u8FD8\u6CA1\u6709\u53E5\u5B50\u3002</div>'}</div></details>`;
}
function bindSentenceLibraryActions() {
  document.querySelectorAll("[data-whole-entry]").forEach((button) => button.onclick = () => {
    const [bookId, entryId] = button.dataset.wholeEntry.split("|");
    startWholeSentenceEntry(bookId, entryId);
  });
  document.querySelectorAll("[data-split-entry]").forEach((button) => button.onclick = () => {
    const [bookId, entryId] = button.dataset.splitEntry.split("|");
    startSavedEntryDictation(bookId, entryId, { onlyProblems: false, unique: false });
  });
  document.querySelectorAll("[data-problem-entry]").forEach((button) => button.onclick = () => {
    const [bookId, entryId] = button.dataset.problemEntry.split("|");
    startSavedEntryDictation(bookId, entryId, { onlyProblems: true, unique: true });
  });
  document.querySelectorAll("[data-ignore-entry]").forEach((button) => button.onclick = () => {
    const [bookId, entryId] = button.dataset.ignoreEntry.split("|");
    const { entry } = getSentenceEntry(state, bookId, entryId);
    if (!entry) return;
    setSentencePracticeStatus(entry, deriveSentencePracticeStatus(entry) === "ignored" ? "unseen" : "ignored");
    persist();
    renderText();
  });
}
function renderText() {
  if (textReaderId) return renderTextReader();
  ensureSentenceBooks(state);
  ensureSimpleWords(state);
  const cols = [...new Set(state.texts.map((t) => t.collection || "\u672A\u5206\u7C7B"))].sort();
  const editing = textEditId ? state.texts.find((t) => t.id === textEditId) : null;
  const sentenceBookNames = state.sentenceBooks.map((b) => b.name);
  const sentenceBookRows = state.sentenceBooks.map(sentenceLibraryBookHtml).join("");
  const staleSentenceLinks = staleLinkedSentenceCount(state);
  shell(`<div class="stack"><section class="card hero"><div class="space"><div><h2>\u6587\u672C\u4E0E\u53E5\u5B50</h2><p>\u6587\u7AE0 \u2192 \u7A33\u5B9A\u53E5\u5B50 \u2192 \u6574\u53E5\u542C\u5199 / \u62C6\u8BCD\u542C\u5199 / \u9519\u8BCD\u91CD\u542C\u3002\u53E5\u5B50\u672C\u8EAB\u4E0D\u8FDB\u5165 FSRS\uFF1B\u5BFC\u5165\u666E\u901A\u8BCD\u4E66\u7684\u9519\u8BCD\u624D\u8FDB\u5165\u6B63\u5F0F\u590D\u4E60\u3002</p></div><button id="newText" class="primary">${textFormOpen || editing ? "\u6536\u8D77" : "\u65B0\u5EFA\u6587\u672C"}</button></div></section><section class="card"><h2 class="section-title">\u5FEB\u901F\u4FDD\u5B58\u4E00\u53E5\u5E76\u62C6\u8BCD</h2><div class="small">\u9002\u5408\u4E34\u65F6\u53E5\u5B50\u3002\u9ED8\u8BA4\u4FDD\u7559\u91CD\u590D\u8BCD\u4F4D\u7F6E\uFF1B\u6807\u8BB0\u7B80\u5355\u7684\u8BCD\u81EA\u52A8\u8DF3\u8FC7\u3002</div><div class="field" style="margin-top:10px"><label>\u4FDD\u5B58\u5230\u53E5\u5B50\u5E93</label><input id="sentenceBookName" list="sentenceBookNames" value="${esc(sentenceBookNames[0] || "\u53E5\u5B50\u8BCD\u5E93")}" placeholder="\u4F8B\u5982\uFF1A\u525118\u53E5\u5B50"><datalist id="sentenceBookNames">${sentenceBookNames.map((x) => `<option value="${esc(x)}">`).join("")}</datalist></div><textarea id="sentenceDictationText" style="min-height:105px;margin-top:10px" placeholder="The farmers are working in rural areas."></textarea><div class="row" style="margin-top:10px"><label class="small"><input id="sentenceUnique" type="checkbox" style="width:auto"> \u53BB\u91CD\u540E\u62C6\u8BCD</label><button id="startQuickWhole" class="primary">\u4FDD\u5B58\u5E76\u6574\u53E5\u542C\u5199</button><button id="startSentenceDictation" class="soft">\u4FDD\u5B58\u5E76\u62C6\u8BCD\u542C\u5199</button><button id="saveQuickOnly" class="ghost">\u53EA\u4FDD\u5B58</button></div><div id="sentencePreview" class="source-tags" style="justify-content:flex-start;margin-top:10px"></div></section><section class="card"><h2 class="section-title">\u53E5\u5B50\u9519\u8BCD\u5B9A\u4F4D\u4E0E\u91CD\u542C</h2><div class="small">\u53EF\u4EE5\u641C\u6587\u7AE0\u6807\u9898\u3001\u53E5\u5B50\u539F\u6587\u6216\u5355\u8BCD\uFF1B\u4ECE\u6587\u7AE0\u4EA7\u751F\u7684\u53E5\u5B50\u4F7F\u7528\u7A33\u5B9A\u53E5\u5B50 ID \u5173\u8054\uFF0C\u4E0D\u518D\u53EA\u9760\u201C\u7B2C\u51E0\u53E5\u201D\u3002</div><div class="filtergrid" style="margin-top:12px"><div class="field"><label>\u53E5\u5B50\u5E93</label><select id="sentenceProblemBook"><option value="">\u5168\u90E8\u53E5\u5B50\u5E93</option>${state.sentenceBooks.map((book) => `<option value="${book.id}">${esc(book.name)}</option>`).join("")}</select></div><div class="field"><label>\u68C0\u7D22</label><input id="sentenceProblemSearch" placeholder="\u6587\u7AE0\u6807\u9898 / \u53E5\u5B50 / \u9519\u8BCD"></div></div><label class="small" style="display:block;margin-top:10px"><input id="sentenceProblemUnique" type="checkbox" checked style="width:auto"> \u9519\u8BCD\u91CD\u542C\u65F6\u53BB\u91CD</label><div id="sentenceProblemList" style="margin-top:12px"></div></section>${state.sentenceBooks.length ? `<section class="card"><h2 class="section-title">\u6211\u7684\u53E5\u5B50\u5E93</h2><div class="space"><div class="small">\u9ED8\u8BA4\u6309\u201C\u9700\u91CD\u7EC3 \u2192 \u672A\u7EC3 \u2192 \u5DF2\u901A\u8FC7 \u2192 \u5FFD\u7565\u201D\u6392\u5217\u3002\u6765\u6E90\u88AB\u5220\u9664\u6216\u539F\u6587\u5DF2\u4FEE\u6539\u7684\u65E7\u53E5\u4F1A\u660E\u786E\u6807\u51FA\u6765\u3002</div>${staleSentenceLinks ? `<button id="cleanupStaleSentences" class="ghost">\u6E05\u7406\u5931\u6548\u65E7\u53E5 \xB7 ${staleSentenceLinks}</button>` : ""}</div><div class="sentence-library">${sentenceBookRows}</div></section>` : ""}${textFormOpen || editing ? `<section class="card"><h2 class="section-title">${editing ? "\u7F16\u8F91\u6587\u672C" : "\u65B0\u5EFA\u6587\u672C"}</h2><div class="grid2" style="margin-top:12px"><div class="field"><label>\u6807\u9898</label><input id="textTitle" value="${esc(editing?.title || "")}" placeholder="Test 3 Part 4"></div><div class="field"><label>\u6240\u5C5E\u6587\u672C\u5E93</label><input id="textCollection" value="${esc(editing?.collection || "")}" placeholder="\u525118"></div></div><textarea id="textBody" style="margin-top:10px" placeholder="\u7C98\u8D34 transcript / \u6587\u7AE0\u6B63\u6587\u2026">${esc(editing?.body || "")}</textarea><div class="row" style="margin-top:10px"><button id="saveText" class="primary">\u4FDD\u5B58</button><button id="importTextFile" class="soft">\u5BFC\u5165 TXT</button></div></section>` : ""}<section class="card"><div class="space"><div><h2 class="section-title">\u6211\u7684\u6587\u672C</h2><div class="small">\u6253\u5F00\u6587\u7AE0\u540E\uFF0C\u6BCF\u4E00\u53E5\u90FD\u6709\u201C\u6574\u53E5\u542C\u5199 / \u62C6\u8BCD\u542C\u5199 / \u672C\u53E5\u9519\u8BCD\u201D\u3002</div></div></div><div class="grid2" style="margin-top:12px"><input id="textSearch" placeholder="\u641C\u7D22\u6587\u672C"><select id="textFilter"><option value="">\u5168\u90E8\u6587\u672C\u5E93</option>${cols.map((c) => `<option>${esc(c)}</option>`).join("")}</select></div><div id="textList" class="list" style="margin-top:12px"></div></section></div>`);
  document.getElementById("newText").onclick = () => {
    textFormOpen = !textFormOpen;
    if (!textFormOpen) textEditId = null;
    renderText();
  };
  if (textFormOpen || editing) {
    document.getElementById("saveText").onclick = saveTextItem;
    document.getElementById("importTextFile").onclick = () => textInput.click();
  }
  const sentenceBox = document.getElementById("sentenceDictationText"), unique3 = document.getElementById("sentenceUnique"), preview = document.getElementById("sentencePreview");
  const drawSentencePreview = () => {
    const tokens = tokenizeEnglish(sentenceBox.value, { unique: unique3.checked });
    preview.innerHTML = tokens.slice(0, 30).map((x) => `<span class="tag">${esc(x)}${isSimpleLexeme(state, x) ? " \xB7 \u7B80\u5355" : ""}</span>`).join("") + (tokens.length > 30 ? `<span class="tag">\u2026 \u5171 ${tokens.length} \u4E2A</span>` : "");
  };
  sentenceBox.oninput = drawSentencePreview;
  unique3.onchange = drawSentencePreview;
  document.getElementById("startQuickWhole").onclick = () => startQuickWhole(sentenceBox.value, document.getElementById("sentenceBookName").value);
  document.getElementById("startSentenceDictation").onclick = () => startSentenceDictation(sentenceBox.value, unique3.checked, document.getElementById("sentenceBookName").value);
  document.getElementById("saveQuickOnly").onclick = () => saveQuickOnly(sentenceBox.value, document.getElementById("sentenceBookName").value);
  document.getElementById("sentenceProblemBook").onchange = drawSentenceProblemList;
  document.getElementById("sentenceProblemSearch").oninput = drawSentenceProblemList;
  document.getElementById("sentenceProblemUnique").onchange = drawSentenceProblemList;
  drawSentenceProblemList();
  bindSentenceLibraryActions();
  if (document.getElementById("cleanupStaleSentences")) document.getElementById("cleanupStaleSentences").onclick = () => {
    if (!confirm(`\u6E05\u7406 ${staleSentenceLinks} \u6761\u6765\u6E90\u5DF2\u5220\u9664\u6216\u539F\u6587\u5DF2\u4FEE\u6539\u7684\u65E7\u53E5\u8BB0\u5F55\uFF1F\u6B63\u5F0F\u8BCD\u5E93\u4E0D\u4F1A\u53D7\u5F71\u54CD\u3002`)) return;
    const n = removeStaleLinkedSentences(state);
    persist();
    toast(`\u5DF2\u6E05\u7406 ${n} \u6761\u65E7\u53E5`);
    renderText();
  };
  document.getElementById("textSearch").oninput = drawTextList;
  document.getElementById("textFilter").onchange = drawTextList;
  drawTextList();
}
function activeProblemRows() {
  const bookId = document.getElementById("sentenceProblemBook")?.value || "";
  const query = document.getElementById("sentenceProblemSearch")?.value || "";
  return findSentenceProblemEntries(state, { bookId, query }).map((row) => ({ ...row, problems: row.problems.filter((token) => !isSimpleLexeme(state, token.normalized || token.surface)) })).filter((row) => row.problems.length);
}
function problemSummary(problems) {
  const map = /* @__PURE__ */ new Map();
  for (const token of problems) {
    const key = token.normalized || String(token.surface).toLowerCase();
    map.set(key, (map.get(key) || 0) + 1);
  }
  return [...map.entries()].map(([word, count]) => `${esc(word)}${count > 1 ? ` \xD7${count}` : ""}`).join(" \xB7 ");
}
function drawSentenceProblemList() {
  const box = document.getElementById("sentenceProblemList");
  if (!box) return;
  const rows = activeProblemRows();
  const uniqueWords = new Set(rows.flatMap((row) => row.problems.map((token) => token.normalized || String(token.surface).toLowerCase())));
  const unique3 = document.getElementById("sentenceProblemUnique")?.checked !== false;
  box.innerHTML = `<div class="space"><div><b>${rows.length} \u53E5 \xB7 ${uniqueWords.size} \u4E2A\u9519\u8BCD</b><div class="small">\u70B9\u67D0\u4E00\u53E5\u7CBE\u51C6\u91CD\u7EC3\uFF0C\u4E5F\u53EF\u4EE5\u628A\u5F53\u524D\u68C0\u7D22\u7ED3\u679C\u4E00\u8D77\u91CD\u542C\u3002</div></div><button id="retryFilteredProblems" class="primary" ${rows.length ? "" : "disabled"}>\u91CD\u542C\u5F53\u524D\u7B5B\u9009\u9519\u8BCD</button></div><div style="margin-top:10px">${rows.map((row) => `<article class="textitem"><div class="space"><div><h3>${esc(sentenceSourceLabel(row.entry))}</h3><div class="small">${esc(row.book.name)} \xB7 ${problemSummary(row.problems)}</div></div></div><p class="snippet">${esc(row.entry.text)}</p><div class="toolbar"><button class="primary" data-whole-problem-entry="${row.book.id}|${row.entry.id}">\u6574\u53E5\u542C\u5199</button><button class="soft" data-retry-entry="${row.book.id}|${row.entry.id}">\u53EA\u91CD\u542C\u8FD9\u53E5\u9519\u8BCD</button><button class="soft" data-retry-entry-all="${row.book.id}|${row.entry.id}">\u91CD\u505A\u672C\u53E5\u62C6\u8BCD</button></div></article>`).join("")}</div>`;
  document.getElementById("retryFilteredProblems").onclick = () => startSentenceProblemRows(rows, unique3, "\u7B5B\u9009\u51FA\u6765\u7684\u53E5\u5B50\u9519\u8BCD");
  document.querySelectorAll("[data-whole-problem-entry]").forEach((button) => button.onclick = () => {
    const [bookId, entryId] = button.dataset.wholeProblemEntry.split("|");
    startWholeSentenceEntry(bookId, entryId);
  });
  document.querySelectorAll("[data-retry-entry]").forEach((button) => button.onclick = () => {
    const [bookId, entryId] = button.dataset.retryEntry.split("|");
    startSavedEntryDictation(bookId, entryId, { onlyProblems: true, unique: unique3 });
  });
  document.querySelectorAll("[data-retry-entry-all]").forEach((button) => button.onclick = () => {
    const [bookId, entryId] = button.dataset.retryEntryAll.split("|");
    startSavedEntryDictation(bookId, entryId, { onlyProblems: false, unique: false });
  });
}
function saveQuickEntries(raw, bookName) {
  const segments = segmentTextSentences(raw);
  if (!segments.length) return [];
  const out = [];
  for (const row of segments) {
    const tokens = tokenizeEnglish(row.text, { unique: false });
    if (!tokens.length) continue;
    const saved = addSentenceEntry(state, { bookName: bookName || "\u53E5\u5B50\u8BCD\u5E93", text: row.text, tokens });
    out.push({ bookId: saved.book.id, entryId: saved.entry.id });
  }
  persist();
  return out;
}
function startQuickWhole(raw, bookName) {
  const entries = saveQuickEntries(raw, bookName);
  if (!entries.length) return toast("\u6CA1\u6709\u8BC6\u522B\u5230\u53EF\u542C\u5199\u7684\u53E5\u5B50");
  startWholeSequence(entries, null);
}
function saveQuickOnly(raw, bookName) {
  const entries = saveQuickEntries(raw, bookName);
  if (!entries.length) return toast("\u6CA1\u6709\u8BC6\u522B\u5230\u53E5\u5B50");
  toast(`\u5DF2\u4FDD\u5B58 ${entries.length} \u53E5`);
  renderText();
}
function ensureLinkedSentenceEntry(text, sentenceRecord, sentenceIndex) {
  const allTokens = tokenizeEnglish(sentenceRecord.text, { unique: false });
  return addSentenceEntry(state, { bookName: `${text.collection || "\u6587\u672C"} \xB7 \u53E5\u5B50`, text: sentenceRecord.text, tokens: allTokens, sourceTextId: text.id, sourceSentenceId: sentenceRecord.id, sourceTitle: text.title, sourceCollection: text.collection || "\u672A\u5206\u7C7B", sentenceIndex });
}
function startWholeSentenceFromText(text, sentenceRecord, sentenceIndex) {
  const saved = ensureLinkedSentenceEntry(text, sentenceRecord, sentenceIndex);
  persist();
  startWholeSentenceEntry(saved.book.id, saved.entry.id, { returnTextId: text.id });
}
function startWholeSentenceEntry(bookId, entryId, { returnTextId = null, preserveQueue = false } = {}) {
  if (!preserveQueue) wholeQueue = [];
  const { book, entry } = getSentenceEntry(state, bookId, entryId);
  if (!book || !entry) return toast("\u6CA1\u6709\u627E\u5230\u8FD9\u53E5\u8BB0\u5F55");
  wholeSentenceRun = { bookId, entryId, returnTextId, input: "", alignment: null, revealed: false, peek: false };
  renderWholeSentenceRun();
  speak(entry.text);
}
function startWholeSequence(items, returnTextId = null) {
  const queue = (items || []).filter(Boolean);
  if (!queue.length) return toast("\u6CA1\u6709\u53EF\u542C\u5199\u7684\u53E5\u5B50");
  wholeQueue = queue.slice(1);
  const first = queue[0];
  startWholeSentenceEntry(first.bookId, first.entryId, { returnTextId, preserveQueue: true });
}
function continueWholeSequence(run) {
  if (wholeQueue.length) {
    const next = wholeQueue.shift();
    wholeSentenceRun = null;
    startWholeSentenceEntry(next.bookId, next.entryId, { returnTextId: run?.returnTextId || null, preserveQueue: true });
    return;
  }
  returnFromWholeSentenceRun(run);
}
function wholeSentenceCurrent() {
  if (!wholeSentenceRun) return {};
  return getSentenceEntry(state, wholeSentenceRun.bookId, wholeSentenceRun.entryId);
}
function applyWholeAlignment(entry, alignment) {
  const wrong = new Set(alignment.wrongExpectedIndexes || []);
  for (let i = 0; i < (entry.tokens || []).length; i++) {
    const token = entry.tokens[i];
    if (isSimpleLexeme(state, token.normalized || token.surface)) {
      setSentenceTokenStatus(entry, i, "familiar");
      continue;
    }
    setSentenceTokenStatus(entry, i, wrong.has(i) ? "unfamiliar" : "familiar");
  }
}
function wholeDiffHtml(alignment) {
  if (!alignment) return "";
  return `<div class="sentence-diff">${alignment.operations.map((op) => op.type === "equal" ? `<span class="equal">${esc(op.expected)}</span>` : op.type === "replace" ? `<span class="replace">${esc(op.expected)} \u2192 ${esc(op.actual)}</span>` : op.type === "missing" ? `<span class="missing">${esc(op.expected)}\uFF08\u6F0F\uFF09</span>` : `<span class="extra">+ ${esc(op.actual)}</span>`).join("")}</div>`;
}
function returnFromWholeSentenceRun(run) {
  wholeSentenceRun = null;
  wholeQueue = [];
  if (run?.returnTextId) {
    textReaderId = run.returnTextId;
    view = "text";
    renderTextReader();
  } else {
    view = "text";
    renderText();
  }
}
function renderWholeSentenceRun() {
  const run = wholeSentenceRun;
  const { book, entry } = wholeSentenceCurrent();
  if (!run || !book || !entry) {
    wholeSentenceRun = null;
    view = "text";
    return renderText();
  }
  const st = sentenceStateInfo(entry);
  const problems = sentenceProblemTokens(entry).filter((token) => !isSimpleLexeme(state, token.normalized || token.surface));
  root.innerHTML = `<main class="immersive"><div class="studytop"><button id="wholeBack" class="back">\u2039</button><div class="studyprogress">\u6574\u53E5\u542C\u5199 \xB7 ${esc(sentenceSourceLabel(entry))}</div><button id="wholeIgnore" class="retire">${st.status === "ignored" ? "\u6062\u590D\u672C\u53E5" : "\u5FFD\u7565\u672C\u53E5"}</button></div><div class="studybody" style="max-width:820px"><span class="sentence-state ${st.status}">${st.label}</span><button id="wholeSpeak" class="speaker">\u25D6))</button>${!run.revealed ? `<div class="small">\u5148\u542C\u5B8C\u6574\u53E5\u5B50\uFF0C\u518D\u628A\u6574\u53E5\u5199\u4E0B\u6765\u3002\u6807\u70B9\u4E0D\u53C2\u4E0E\u5BF9\u9519\uFF1B\u6309\u5355\u8BCD\u987A\u5E8F\u505A\u5BF9\u9F50\u3002</div><textarea id="wholeSentenceAnswer" class="whole-answer" placeholder="\u8F93\u5165\u4F60\u542C\u5230\u7684\u5B8C\u6574\u82F1\u6587\u53E5\u5B50\u2026" autocomplete="off" autocapitalize="off">${esc(run.input)}</textarea><div class="grid2" style="width:100%;max-width:720px;margin-top:10px"><button id="wholeSubmit" class="primary">\u63D0\u4EA4\u6574\u53E5</button><button id="wholeReveal" class="soft">\u770B\u539F\u53E5</button></div>` : `${run.peek ? `<div class="small">\u672C\u6B21\u76F4\u63A5\u770B\u4E86\u539F\u53E5\uFF0C\u8FD9\u53E5\u6807\u8BB0\u4E3A\u201C\u9700\u91CD\u7EC3\u201D\u3002</div><div class="sentence" style="max-width:720px">${esc(entry.text)}</div>` : `<div class="small">${run.alignment?.correct ? "\u6574\u53E5\u6B63\u786E" : "\u6309\u5355\u8BCD\u5BF9\u9F50\u7ED3\u679C\u5982\u4E0B"}</div>${wholeDiffHtml(run.alignment)}<div class="typed" style="max-width:720px"><b>\u4F60\u5199\u7684\u662F</b><div>${esc(run.input || "\uFF08\u7A7A\uFF09")}</div></div>`}<div class="sentence-mode-row" style="justify-content:center"><button id="wholeReplay" class="soft">\u91CD\u542C\u6574\u53E5</button><button id="wholeRedoSplit" class="soft">\u91CD\u505A\u672C\u53E5\u62C6\u8BCD</button>${problems.length ? `<button id="wholeProblems" class="soft">\u53EA\u7EC3\u9519\u8BCD \xB7 ${problems.length}</button>` : ""}<button id="wholeRetry" class="primary">\u518D\u5199\u4E00\u6B21\u6574\u53E5</button><button id="wholeFinish" class="soft">${wholeQueue.length ? `\u4E0B\u4E00\u53E5 \xB7 ${wholeQueue.length}` : `\u8FD4\u56DE`}</button></div>`}</div></main>`;
  document.getElementById("wholeBack").onclick = () => returnFromWholeSentenceRun(run);
  document.getElementById("wholeSpeak").onclick = () => speak(entry.text);
  document.getElementById("wholeIgnore").onclick = () => {
    setSentencePracticeStatus(entry, st.status === "ignored" ? "unseen" : "ignored");
    persist();
    renderWholeSentenceRun();
  };
  if (!run.revealed) {
    const input = document.getElementById("wholeSentenceAnswer");
    input.focus();
    document.getElementById("wholeSubmit").onclick = () => {
      run.input = input.value.trim();
      if (!run.input) return toast("\u6CA1\u5199\u5185\u5BB9\u7684\u8BDD\u70B9\u201C\u770B\u539F\u53E5\u201D");
      run.alignment = alignSentenceInput(entry.text, run.input);
      applyWholeAlignment(entry, run.alignment);
      recordWholeSentenceAttempt(entry, { input: run.input, alignment: run.alignment, revealed: false });
      run.revealed = true;
      persist();
      renderWholeSentenceRun();
    };
    document.getElementById("wholeReveal").onclick = () => {
      run.input = input.value.trim();
      run.peek = true;
      run.revealed = true;
      recordWholeSentenceAttempt(entry, { input: run.input, revealed: true });
      persist();
      renderWholeSentenceRun();
    };
  } else {
    document.getElementById("wholeReplay").onclick = () => speak(entry.text);
    document.getElementById("wholeRedoSplit").onclick = () => {
      const ret = run.returnTextId;
      wholeSentenceRun = null;
      startSavedEntryDictation(book.id, entry.id, { onlyProblems: false, unique: false, returnTextId: ret });
    };
    if (document.getElementById("wholeProblems")) document.getElementById("wholeProblems").onclick = () => {
      const ret = run.returnTextId;
      wholeSentenceRun = null;
      startSavedEntryDictation(book.id, entry.id, { onlyProblems: true, unique: true, returnTextId: ret });
    };
    document.getElementById("wholeRetry").onclick = () => {
      run.input = "";
      run.alignment = null;
      run.revealed = false;
      run.peek = false;
      renderWholeSentenceRun();
      speak(entry.text);
    };
    document.getElementById("wholeFinish").onclick = () => continueWholeSequence(run);
  }
}
function startSentenceDictation(text, unique3, bookName, meta = {}) {
  const allTokens = tokenizeEnglish(text, { unique: false });
  if (!allTokens.length) return toast("\u8FD9\u53E5\u8BDD\u91CC\u6CA1\u6709\u8BC6\u522B\u5230\u82F1\u6587\u5355\u8BCD");
  const saved = addSentenceEntry(state, { bookName: bookName || "\u53E5\u5B50\u8BCD\u5E93", text, tokens: allTokens, sourceTextId: meta.sourceTextId || null, sourceSentenceId: meta.sourceSentenceId || null, sourceTitle: meta.sourceTitle || "", sourceCollection: meta.sourceCollection || "", sentenceIndex: meta.sentenceIndex ?? null });
  persist();
  const indexes = sentencePracticeIndexes(state, saved.entry, { unique: unique3, skipSimple: true });
  const skippedSimple = saved.entry.tokens.filter((token) => isSimpleLexeme(state, token.normalized || token.surface)).length;
  if (!indexes.length) return toast("\u8FD9\u53E5\u6CA1\u6709\u9700\u8981\u542C\u5199\u7684\u8BCD\uFF1B\u5DF2\u6807\u8BB0\u7B80\u5355\u7684\u8BCD\u4F1A\u81EA\u52A8\u8DF3\u8FC7");
  const items = indexes.map((tokenIndex) => ({ bookId: saved.book.id, entryId: saved.entry.id, tokenIndex }));
  startSentenceItems(items, meta.label || sentenceSourceLabel(saved.entry), { returnTextId: meta.returnTextId || null, skippedSimple });
}
function startLinkedSentenceDictation(text, sentenceRecord, sentenceIndex) {
  const bookName = `${text.collection || "\u6587\u672C"} \xB7 \u53E5\u5B50`;
  startSentenceDictation(sentenceRecord.text, false, bookName, { sourceTextId: text.id, sourceSentenceId: sentenceRecord.id, sourceTitle: text.title, sourceCollection: text.collection || "\u672A\u5206\u7C7B", sentenceIndex, returnTextId: text.id, label: `${text.title} \xB7 \u7B2C ${sentenceIndex + 1} \u53E5` });
}
function startSavedEntryDictation(bookId, entryId, { onlyProblems = false, unique: unique3 = false, returnTextId = null } = {}) {
  const { book, entry } = getSentenceEntry(state, bookId, entryId);
  if (!book || !entry) return toast("\u6CA1\u6709\u627E\u5230\u8FD9\u53E5\u8BB0\u5F55");
  const indexes = sentencePracticeIndexes(state, entry, { onlyProblems, unique: unique3, skipSimple: true });
  if (!indexes.length) return toast(onlyProblems ? "\u8FD9\u53E5\u5F53\u524D\u6CA1\u6709\u9700\u8981\u91CD\u542C\u7684\u9519\u8BCD" : "\u8FD9\u53E5\u7684\u8BCD\u90FD\u5DF2\u6807\u8BB0\u7B80\u5355");
  const items = indexes.map((tokenIndex) => ({ bookId, entryId, tokenIndex }));
  startSentenceItems(items, onlyProblems ? `${sentenceSourceLabel(entry)} \xB7 \u9519\u8BCD` : sentenceSourceLabel(entry), { returnTextId });
}
function startSentenceProblemRows(rows, unique3 = true, label = "\u53E5\u5B50\u9519\u8BCD", returnTextId = null) {
  const items = [];
  const seen = /* @__PURE__ */ new Set();
  for (const row of rows) {
    for (const token of row.problems || []) {
      const key = token.normalized || String(token.surface).toLowerCase();
      if (isSimpleLexeme(state, key)) continue;
      if (unique3 && seen.has(key)) continue;
      seen.add(key);
      items.push({ bookId: row.book.id, entryId: row.entry.id, tokenIndex: token.tokenIndex });
    }
  }
  if (!items.length) return toast("\u5F53\u524D\u7B5B\u9009\u6CA1\u6709\u9700\u8981\u91CD\u542C\u7684\u9519\u8BCD");
  startSentenceItems(items, label, { returnTextId });
}
function startSentenceItems(items, label, { returnTextId = null, skippedSimple = 0 } = {}) {
  sentenceRun = { items: [...items], cursor: 0, label, input: "", result: null, revealed: false, lookups: 0, correct: 0, returnTextId, skippedSimple };
  renderSentenceRun();
  const current = sentenceRunCurrent();
  if (current?.token) speak(current.token.surface);
}
function sentenceRunCurrent() {
  const item = sentenceRun?.items?.[sentenceRun.cursor];
  if (!item) return null;
  const { book, entry } = getSentenceEntry(state, item.bookId, item.entryId);
  const token = entry?.tokens?.[item.tokenIndex] || null;
  return { item, book, entry, token, tokenIndex: item.tokenIndex };
}
function sentenceRunProblemTokens(run) {
  const byWord = /* @__PURE__ */ new Map();
  for (const item of run?.items || []) {
    const { entry } = getSentenceEntry(state, item.bookId, item.entryId);
    const token = entry?.tokens?.[item.tokenIndex];
    if (!token || !["unfamiliar", "unknown"].includes(token.status) || isSimpleLexeme(state, token.normalized || token.surface)) continue;
    const key = token.normalized || String(token.surface).toLowerCase();
    if (!byWord.has(key)) byWord.set(key, { ...token, normalized: key, sentence: entry.text, sourceTextId: entry.sourceTextId || null, sourceTitle: entry.sourceTitle || "", sourceCollection: entry.sourceCollection || "", sentenceIndex: entry.sentenceIndex });
  }
  return [...byWord.values()];
}
function sentenceRunProblemItems(run, unique3 = true) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const item of run?.items || []) {
    const { entry } = getSentenceEntry(state, item.bookId, item.entryId);
    const token = entry?.tokens?.[item.tokenIndex];
    if (!token || !["unfamiliar", "unknown"].includes(token.status) || isSimpleLexeme(state, token.normalized || token.surface)) continue;
    const key = token.normalized || String(token.surface).toLowerCase();
    if (unique3 && seen.has(key)) continue;
    seen.add(key);
    out.push({ ...item });
  }
  return out;
}
function returnFromSentenceRun(run) {
  sentenceRun = null;
  if (run?.returnTextId) {
    textReaderId = run.returnTextId;
    view = "text";
    renderTextReader();
  } else {
    view = "text";
    renderText();
  }
}
function advanceSentenceRun() {
  sentenceRun.cursor++;
  sentenceRun.input = "";
  sentenceRun.result = null;
  sentenceRun.revealed = false;
  while (sentenceRun.cursor < sentenceRun.items.length) {
    const current2 = sentenceRunCurrent();
    if (current2?.token && !isSimpleLexeme(state, current2.token.normalized || current2.token.surface)) break;
    sentenceRun.cursor++;
  }
  if (sentenceRun.cursor >= sentenceRun.items.length) return finishSentenceRun();
  renderSentenceRun();
  const current = sentenceRunCurrent();
  if (current?.token) speak(current.token.surface);
}
function renderSentenceRun() {
  const current = sentenceRunCurrent();
  if (!current?.book || !current?.entry || !current?.token) return finishSentenceRun();
  const { book, entry, token, tokenIndex } = current;
  const status = token.status;
  const sameIndexes = entry.tokens.map((x, i) => ({ x, i })).filter(({ x }) => (x.normalized || String(x.surface).toLowerCase()) === (token.normalized || String(token.surface).toLowerCase())).map(({ i }) => i);
  const duplicateNote = sameIndexes.length > 1 ? ` \xB7 \u540C\u8BCD\u7B2C ${sameIndexes.indexOf(tokenIndex) + 1}/${sameIndexes.length} \u6B21` : "";
  root.innerHTML = `<main class="immersive"><div class="studytop"><button id="sentenceBack" class="back">\u2039</button><div class="studyprogress">${sentenceRun.cursor + 1} / ${sentenceRun.items.length} \xB7 ${esc(sentenceRun.label || book.name)}</div></div><div class="studybody"><div class="small">${esc(sentenceSourceLabel(entry))}${duplicateNote}${sentenceRun.skippedSimple ? ` \xB7 \u5DF2\u8DF3\u8FC7\u7B80\u5355\u8BCD ${sentenceRun.skippedSimple}` : ""}</div><button id="sentenceSpeak" class="speaker">\u25D6))</button>${!sentenceRun.revealed ? `<div class="small">\u542C\u5355\u8BCD\uFF0C\u5199\u51FA\u82F1\u6587\u62FC\u5199\u3002</div><div style="width:100%;max-width:560px;margin-top:18px"><input id="sentenceAnswer" style="font-size:21px;text-align:center" placeholder="\u8F93\u5165\u82F1\u6587\u62FC\u5199\u2026" autocomplete="off" autocapitalize="off"><div class="grid2" style="margin-top:10px"><button id="sentenceSubmit" class="primary">\u63D0\u4EA4</button><button id="sentenceReveal" class="soft">\u770B\u7B54\u6848</button></div></div>` : `<div class="word ${sentenceRun.result === "good" ? "good" : "bad"}">${esc(token.surface)}</div><div class="typed"><b>\u4F60\u5199\u7684\u662F</b><div>${esc(sentenceRun.input || "\uFF08\u76F4\u63A5\u770B\u7B54\u6848\uFF09")}</div></div><div class="statusline">${sentenceRun.result === "good" ? "\u62FC\u5199\u6B63\u786E" : "\u5DF2\u663E\u793A\u6B63\u786E\u62FC\u5199"} \xB7 \u518D\u6807\u8BB0\u771F\u5B9E\u719F\u6089\u5EA6</div><div class="judges" style="grid-template-columns:repeat(3,1fr)"><button id="sentenceFamiliar" class="${status === "familiar" ? "goodbtn" : "soft"}">\u719F\u6089</button><button id="sentenceUnfamiliar" class="${status === "unfamiliar" ? "badbtn" : "soft"}">\u4E0D\u719F\u6089</button><button id="sentenceUnknown" class="${status === "unknown" ? "badbtn" : "soft"}">\u4E0D\u8BA4\u8BC6</button></div><div class="move"><button id="sentenceSimple" class="soft">\u6807\u8BB0\u7B80\u5355</button><button id="sentenceReplay" class="soft">\u91CD\u542C</button><button id="sentenceNext" class="primary">\u4E0B\u4E00\u8BCD</button></div>`}</div></main>`;
  document.getElementById("sentenceBack").onclick = () => {
    persist();
    const run = sentenceRun;
    returnFromSentenceRun(run);
  };
  document.getElementById("sentenceSpeak").onclick = () => speak(token.surface);
  if (!sentenceRun.revealed) {
    const input = document.getElementById("sentenceAnswer");
    input.value = sentenceRun.input;
    input.focus();
    const reveal = (peek) => {
      sentenceRun.input = input.value.trim();
      sentenceRun.result = !peek && spellingMatches(sentenceRun.input, token.surface) ? "good" : "bad";
      if (sentenceRun.result === "good") sentenceRun.correct++;
      else sentenceRun.lookups++;
      const defaultStatus = sentenceRun.result === "good" ? "familiar" : peek ? "unknown" : "unfamiliar";
      recordSentenceToken(entry, tokenIndex, { input: sentenceRun.input, spellingResult: sentenceRun.result, status: defaultStatus });
      sentenceRun.revealed = true;
      persist();
      renderSentenceRun();
    };
    document.getElementById("sentenceSubmit").onclick = () => {
      if (!input.value.trim()) return toast("\u6CA1\u5199\u7684\u8BDD\u53EF\u4EE5\u70B9\u300C\u770B\u7B54\u6848\u300D");
      reveal(false);
    };
    document.getElementById("sentenceReveal").onclick = () => reveal(true);
    input.onkeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        input.value.trim() ? reveal(false) : reveal(true);
      }
    };
  } else {
    const mark = (x) => {
      setSentenceTokenStatus(entry, tokenIndex, x);
      persist();
      renderSentenceRun();
    };
    document.getElementById("sentenceFamiliar").onclick = () => mark("familiar");
    document.getElementById("sentenceUnfamiliar").onclick = () => mark("unfamiliar");
    document.getElementById("sentenceUnknown").onclick = () => mark("unknown");
    document.getElementById("sentenceSimple").onclick = () => {
      markSimpleLexeme(state, token.normalized || token.surface, true);
      setSentenceTokenStatus(entry, tokenIndex, "familiar");
      persist();
      advanceSentenceRun();
    };
    document.getElementById("sentenceReplay").onclick = () => speak(token.surface);
    document.getElementById("sentenceNext").onclick = advanceSentenceRun;
  }
}
function importSentenceProblems(tokens, targetName, sentence) {
  const target = String(targetName || "\u53E5\u5B50\u9519\u9898\u672C").trim() || "\u53E5\u5B50\u9519\u9898\u672C";
  registerErrorBook(target);
  let missing = 0;
  for (const token of tokens) {
    const en = String(token.normalized || token.surface || "").toLowerCase();
    const existing = state.words.find((w2) => w2.en === en);
    const w = upsertWord({ en, zh: existing?.zh || "", source: target, example: token.sentence || sentence, reviewHint: true });
    if (w && !w.zh) {
      w.needsMeaning = true;
      missing++;
    }
  }
  persist();
  toast(`\u5DF2\u52A0\u5165\u300C${target}\u300D${missing ? ` \xB7 ${missing} \u4E2A\u5F85\u6279\u91CF\u8865\u91CA\u4E49` : ""}`);
}
function finishSentenceRun() {
  const run = sentenceRun;
  if (!run) return;
  const touched = new Set((run.items || []).map((item) => `${item.bookId}|${item.entryId}`));
  for (const key of touched) {
    const [bookId, entryId] = key.split("|");
    const { entry } = getSentenceEntry(state, bookId, entryId);
    if (!entry || deriveSentencePracticeStatus(entry) === "ignored") continue;
    const remain = sentenceProblemTokens(entry).filter((token) => !isSimpleLexeme(state, token.normalized || token.surface));
    setSentencePracticeStatus(entry, remain.length ? "repeat" : "done");
  }
  persist();
  const problems = sentenceRunProblemTokens(run);
  const redoItems = sentenceRunProblemItems(run, true);
  root.innerHTML = `<main class="immersive"><div class="studybody"><div class="finish" style="max-width:720px"><div class="small">\u672C\u8F6E\u5B8C\u6210 \xB7 \u53E5\u5B50\u8BB0\u5F55\u5DF2\u4FDD\u7559</div><h2>\u53E5\u5B50\u62C6\u8BCD\u542C\u5199</h2><div class="grid3" style="margin:18px 0"><div class="statbox"><b>${run.items.length}</b><span>\u672C\u8F6E\u542C\u5199\u4F4D\u7F6E</span></div><div class="statbox"><b class="good">${run.correct}</b><span>\u4E00\u6B21\u62FC\u5BF9</span></div><div class="statbox"><b class="bad">${problems.length}</b><span>\u5F53\u524D\u9519\u8BCD</span></div></div><div class="small" style="margin-bottom:12px">\u53E5\u5B50\u8BCD\u5E93\u672C\u8EAB\u4E0D\u505A FSRS \u5230\u671F\u590D\u4E60\uFF1B\u53EA\u6709\u5BFC\u5165\u666E\u901A\u8BCD\u4E66\u7684\u8BCD\u624D\u8FDB\u5165\u6B63\u5F0F\u5B66\u4E60\u4E0E\u590D\u4E60\u3002\u5BFC\u5165\u540E\u8FD9\u53E5\u4ECD\u7136\u53EF\u4EE5\u7EE7\u7EED\u62C6\u8BCD\u542C\u5199\u3002</div><div class="field" style="text-align:left"><label>\u9519\u8BCD\u8F6C\u5165\u54EA\u4E2A\u666E\u901A\u8BCD\u4E66</label><input id="sentenceErrorBook" value="\u53E5\u5B50\u9519\u9898\u672C" placeholder="\u4F8B\u5982\uFF1A\u525118\u53E5\u5B50\u9519\u9898\u672C"></div><div class="row" style="justify-content:center;margin-top:12px"><button id="importSentenceBad" class="primary" ${problems.length ? "" : "disabled"}>\u52A0\u5165\u9519\u9898\u672C \xB7 ${problems.length}</button><button id="exportSentenceBad" class="soft" ${problems.length ? "" : "disabled"}>\u5BFC\u51FA TSV</button>${redoItems.length ? `<button id="redoSentenceBad" class="soft">\u518D\u542C\u672C\u8F6E\u9519\u8BCD \xB7 ${redoItems.length}</button>` : ""}<button id="finishSentence" class="soft">\u8FD4\u56DE</button></div></div></div></main>`;
  document.getElementById("importSentenceBad").onclick = () => importSentenceProblems(problems, document.getElementById("sentenceErrorBook").value, "");
  document.getElementById("exportSentenceBad").onclick = () => {
    const name = document.getElementById("sentenceErrorBook").value.trim() || "\u53E5\u5B50\u9519\u9898\u672C";
    download(`${name}-${currentDayKey()}.tsv`, problemTokensToTSV(problems, { source: name }), "text/tab-separated-values;charset=utf-8");
  };
  if (document.getElementById("redoSentenceBad")) document.getElementById("redoSentenceBad").onclick = () => {
    const returnTextId = run.returnTextId;
    startSentenceItems(redoItems, "\u672C\u8F6E\u53E5\u5B50\u9519\u8BCD", { returnTextId });
  };
  document.getElementById("finishSentence").onclick = () => returnFromSentenceRun(run);
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
    reconcileTextSentences(t);
  } else {
    const t = { id: uid("text"), title, collection, body, createdAt: now, updatedAt: now, lastOpened: 0, sentence: 0, currentSentenceId: null, hidden: false, loop: false, sentences: [] };
    reconcileTextSentences(t);
    state.texts.unshift(t);
  }
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
  const ss = reconcileTextSentences(t);
  if (!ss.length) return toast("\u8FD9\u7BC7\u6587\u672C\u6CA1\u6709\u53EF\u7EC3\u7684\u53E5\u5B50");
  let idx = t.currentSentenceId ? ss.findIndex((row) => row.id === t.currentSentenceId) : -1;
  if (idx < 0) idx = Math.max(0, Math.min(ss.length - 1, t.sentence || 0));
  const sentenceRecord = ss[idx], sentence = sentenceRecord.text;
  t.sentence = idx;
  t.currentSentenceId = sentenceRecord.id;
  const source = `${t.collection || "\u672A\u5206\u7C7B"} \xB7 ${t.title}`;
  const linkedEntries = state.sentenceBooks.flatMap((book) => (book.entries || []).map((entry) => ({ book, entry }))).filter((row) => row.entry.sourceTextId === t.id && (row.entry.sourceSentenceId && row.entry.sourceSentenceId === sentenceRecord.id || !row.entry.sourceSentenceId && Number(row.entry.sentenceIndex) === Number(idx)));
  const linkedRows = findSentenceProblemEntries(state).filter((row) => row.entry.sourceTextId === t.id && (row.entry.sourceSentenceId && row.entry.sourceSentenceId === sentenceRecord.id || !row.entry.sourceSentenceId && Number(row.entry.sentenceIndex) === Number(idx))).map((row) => ({ ...row, problems: row.problems.filter((token) => !isSimpleLexeme(state, token.normalized || token.surface)) })).filter((row) => row.problems.length);
  const linkedProblemCount = new Set(linkedRows.flatMap((row) => row.problems.map((token) => token.normalized || String(token.surface).toLowerCase()))).size;
  const sentenceState = linkedEntries.length ? sentenceStateInfo(linkedEntries[0].entry) : { status: "unseen", label: "\u672A\u7EC3" };
  root.innerHTML = `<main class="immersive"><div class="studytop"><button id="textBack" class="back">\u2039</button><div class="studyprogress">${esc(t.title)} \xB7 \u7B2C ${idx + 1}/${ss.length} \u53E5<br><span class="small">${esc(t.collection || "\u672A\u5206\u7C7B")}</span></div><button id="textEdit" class="retire">\u7F16\u8F91</button></div><div class="reader"><div class="sentence-entry-meta" style="justify-content:center"><span class="sentence-state ${sentenceState.status}">${sentenceState.label}</span>${linkedProblemCount ? `<span class="small">\u9519\u8BCD ${linkedProblemCount}</span>` : ""}</div><div class="reader-actions"><button id="playFull" class="soft">\u5168\u6587\u6717\u8BFB</button><button id="toggleText" class="soft">${t.hidden ? "\u663E\u793A\u539F\u6587" : "\u9690\u85CF\u539F\u6587"}</button><button id="toggleLoop" class="soft">\u5355\u53E5\u5FAA\u73AF ${t.loop ? "\u5F00" : "\u5173"}</button><button id="dictateWholeSentence" class="primary">\u6574\u53E5\u542C\u5199</button><button id="dictateWholeSequence" class="soft">\u8FDE\u7EED\u6574\u53E5 \xB7 \u6700\u591A10\u53E5</button><button id="dictateSentence" class="soft">\u62C6\u8BCD\u542C\u5199</button>${linkedProblemCount ? `<button id="dictateSentenceProblems" class="soft">\u672C\u53E5\u9519\u8BCD \xB7 ${linkedProblemCount}</button>` : ""}</div><div class="sentence ${t.hidden ? "blur" : ""}">${esc(sentence)}</div><div class="sentence-nav"><button id="prevSentence" class="soft" ${idx === 0 ? "disabled" : ""}>\u4E0A\u4E00\u53E5</button><button id="playSentence" class="primary">\u91CD\u542C\u672C\u53E5</button><button id="nextSentence" class="soft" ${idx === ss.length - 1 ? "disabled" : ""}>\u4E0B\u4E00\u53E5</button></div><section class="card" style="margin-top:14px"><h3 style="margin-top:0">\u5168\u6587</h3><div id="fullText" class="fulltext ${t.hidden ? "blur" : ""}">${esc(t.body)}</div></section><section class="card" style="margin-top:14px"><h3 style="margin-top:0">\u4ECE\u672C\u6587\u52A0\u5165\u5355\u8BCD</h3><div class="small">\u6765\u6E90\u4F1A\u4FDD\u5B58\u4E3A\u300C${esc(source)}\u300D\uFF0C\u4F8B\u53E5\u9ED8\u8BA4\u4FDD\u5B58\u5F53\u524D\u53E5\u3002</div><div class="grid2" style="margin-top:10px"><input id="textWord" placeholder="\u82F1\u6587\u5355\u8BCD"><input id="textZh" placeholder="\u4E2D\u6587\u6838\u5FC3\u4E49\uFF0C\u53EF\u7559\u7A7A"></div><div class="row" style="margin-top:10px"><button id="useSelection" class="soft">\u4F7F\u7528\u9009\u4E2D\u7684\u8BCD</button><button id="addFromText" class="primary">\u52A0\u5165\u8BCD\u5E93</button></div></section></div></main>`;
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
  document.getElementById("dictateWholeSentence").onclick = () => startWholeSentenceFromText(t, sentenceRecord, idx);
  document.getElementById("dictateWholeSequence").onclick = () => {
    const entries = ss.slice(idx, idx + 10).map((row, offset) => {
      const saved = ensureLinkedSentenceEntry(t, row, idx + offset);
      return { bookId: saved.book.id, entryId: saved.entry.id };
    });
    persist();
    startWholeSequence(entries, t.id);
  };
  document.getElementById("dictateSentence").onclick = () => startLinkedSentenceDictation(t, sentenceRecord, idx);
  if (document.getElementById("dictateSentenceProblems")) document.getElementById("dictateSentenceProblems").onclick = () => startSentenceProblemRows(linkedRows, true, `${t.title} \xB7 \u7B2C ${idx + 1} \u53E5\u9519\u8BCD`, t.id);
  document.getElementById("prevSentence").onclick = () => {
    const next = ss[idx - 1];
    t.sentence = idx - 1;
    t.currentSentenceId = next.id;
    persist();
    renderTextReader();
    speak(next.text);
  };
  document.getElementById("nextSentence").onclick = () => {
    const next = ss[idx + 1];
    t.sentence = idx + 1;
    t.currentSentenceId = next.id;
    persist();
    renderTextReader();
    speak(next.text);
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
function upsertWord({ en, zh = "", pos = "", def = "", source = "", example = "", overwrite = false, reviewHint = false }) {
  en = String(en || "").trim().toLowerCase();
  if (!en) return null;
  let w = state.words.find((x) => x.en === en);
  if (!w) {
    w = { id: uid("w"), en, zh, pos, def, sources: [], examples: [], retired: isSimpleLexeme(state, en), reviewHint: Boolean(reviewHint), card: null };
    state.words.push(w);
  }
  if (reviewHint) w.reviewHint = true;
  if (isSimpleLexeme(state, en)) w.retired = true;
  if (zh && (overwrite || !w.zh)) {
    w.zh = zh;
    w.needsMeaning = false;
  }
  if (pos && (overwrite || !w.pos)) w.pos = pos;
  if (def && (overwrite || !w.def)) w.def = def;
  if (source && !w.sources.includes(source)) w.sources.push(source);
  if (example && !w.examples.includes(example)) w.examples.push(example);
  return w;
}
function pendingMeaningHtml() {
  const words = state.words.filter((w) => w.needsMeaning && !w.zh);
  if (!words.length) return "";
  return `<section class="card"><div class="space"><div><h2 class="section-title">\u5F85\u8865\u91CA\u4E49</h2><div class="small">\u53E5\u5B50\u9519\u8BCD\u5148\u65E0\u6253\u65AD\u5BFC\u5165\uFF0C\u8FD9\u91CC\u4E00\u6B21\u6279\u91CF\u8865\u3002\u5171 ${words.length} \u4E2A\u3002</div></div></div><div class="error-compact" style="margin-top:10px">${words.slice(0, 80).map((w) => `<div class="error-row"><span class="en">${esc(w.en)}</span><input data-pending-meaning="${w.id}" placeholder="\u4E2D\u6587\u6838\u5FC3\u4E49" value=""></div>`).join("")}</div><div class="row" style="margin-top:10px"><button id="savePendingMeanings" class="primary">\u4FDD\u5B58\u5DF2\u586B\u5199\u91CA\u4E49</button></div></section>`;
}
function bindPendingMeanings() {
  const b = document.getElementById("savePendingMeanings");
  if (!b) return;
  b.onclick = () => {
    let n = 0;
    document.querySelectorAll("[data-pending-meaning]").forEach((el) => {
      const zh = el.value.trim();
      if (!zh) return;
      const w = wordById(el.dataset.pendingMeaning);
      if (w) {
        w.zh = zh;
        w.needsMeaning = false;
        n++;
      }
    });
    persist();
    toast(`\u5DF2\u8865 ${n} \u4E2A\u91CA\u4E49`);
    renderLibrary();
  };
}
function wordEditorHtml() {
  const w = wordById(wordEditId);
  if (!w) return "";
  return `<section class="card"><div class="space"><div><h2 class="section-title">\u7F16\u8F91\u5355\u8BCD</h2><div class="small">\u82F1\u6587\u4E3B\u952E\u4FDD\u6301\u4E0D\u53D8\uFF1B\u53EF\u4EE5\u6539\u91CA\u4E49\u3001\u8BCD\u6027\u3001\u82F1\u6587\u5B9A\u4E49\u3001\u4F8B\u53E5\u548C\u6240\u5C5E\u8BCD\u4E66\u3002</div></div><button id="cancelWordEdit" class="ghost">\u53D6\u6D88</button></div><div class="grid2" style="margin-top:12px"><div class="field"><label>\u82F1\u6587</label><input value="${esc(w.en)}" disabled></div><div class="field"><label>\u4E2D\u6587</label><input id="editWordZh" value="${esc(w.zh || "")}"></div><div class="field"><label>\u8BCD\u6027</label><input id="editWordPos" value="${esc(w.pos || "")}"></div><div class="field"><label>\u82F1\u6587\u91CA\u4E49</label><input id="editWordDef" value="${esc(w.def || "")}"></div></div><div class="field" style="margin-top:10px"><label>\u6240\u5C5E\u8BCD\u4E66\uFF08\u9017\u53F7\u5206\u9694\uFF09</label><input id="editWordSources" value="${esc((w.sources || []).join(", "))}"></div><div class="field" style="margin-top:10px"><label>\u4F8B\u53E5\uFF08\u6BCF\u884C\u4E00\u6761\uFF09</label><textarea id="editWordExamples" style="min-height:90px">${esc((w.examples || []).join("\n"))}</textarea></div><div class="row" style="margin-top:10px"><button id="saveWordEdit" class="primary">\u4FDD\u5B58\u4FEE\u6539</button><button id="deleteWordEdit" class="danger">\u5F7B\u5E95\u5220\u9664</button></div></section>`;
}
function bindWordEditor() {
  const w = wordById(wordEditId);
  if (!w) return;
  document.getElementById("cancelWordEdit").onclick = () => {
    wordEditId = null;
    renderLibrary();
  };
  document.getElementById("saveWordEdit").onclick = () => {
    updateWordFields(w, { zh: document.getElementById("editWordZh").value, pos: document.getElementById("editWordPos").value, def: document.getElementById("editWordDef").value, sources: document.getElementById("editWordSources").value.split(/[,，]/), examples: document.getElementById("editWordExamples").value.split(/\r?\n/) });
    persist();
    wordEditId = null;
    toast("\u5355\u8BCD\u5DF2\u66F4\u65B0");
    renderLibrary();
  };
  document.getElementById("deleteWordEdit").onclick = () => {
    if (!confirm(`\u5F7B\u5E95\u5220\u9664\u300C${w.en}\u300D\uFF1F\u8FD9\u4F1A\u540C\u65F6\u5220\u9664\u5B83\u7684\u542C\u8BCD/\u624B\u6253\u5386\u53F2\u548C\u4ECA\u65E5\u8BA1\u5212\u5F15\u7528\uFF1B\u53E5\u5B50\u539F\u6587\u4E0D\u4F1A\u5220\u9664\u3002`)) return;
    deleteWordEverywhere(state, w.id);
    persist();
    wordEditId = null;
    toast("\u5DF2\u5220\u9664\u5355\u8BCD");
    renderLibrary();
  };
}
function importFieldSelect(field, label) {
  if (!importDraft) return "";
  const options = ['<option value="-1">\u4E0D\u5BFC\u5165</option>'];
  for (let i = 0; i < importDraft.width; i++) {
    const head = importDraft.header?.[i] || `\u7B2C ${i + 1} \u5217`;
    options.push(`<option value="${i}" ${Number(importDraft.map[field]) === i ? "selected" : ""}>${esc(head)}</option>`);
  }
  return `<label class="small">${label}<select data-import-field="${field}">${options.join("")}</select></label>`;
}
function importPreviewHtml() {
  if (!importDraft) return "";
  const rows = recordsFromDraft(importDraft, importDraft.map);
  const valid = rows.filter((r) => r.valid);
  return `<section class="card"><div class="space"><div><h2 class="section-title">\u786E\u8BA4\u5BFC\u5165 \xB7 ${esc(importDraft.fileName)}</h2><div class="small">${importDraft.delimiter === "	" ? "TSV" : "CSV"} \xB7 ${valid.length} \u884C\u53EF\u5BFC\u5165\u3002\u5148\u786E\u8BA4\u5217\u6620\u5C04\uFF0C\u518D\u5199\u5165\u8BCD\u5E93\u3002</div></div><button id="cancelImportDraft" class="ghost">\u53D6\u6D88</button></div><div class="filtergrid" style="margin-top:12px">${importFieldSelect("en", "\u82F1\u6587")}${importFieldSelect("zh", "\u4E2D\u6587")}${importFieldSelect("pos", "\u8BCD\u6027")}${importFieldSelect("def", "\u82F1\u6587\u91CA\u4E49")}${importFieldSelect("source", "\u8BCD\u4E66/\u6765\u6E90")}${importFieldSelect("example", "\u4F8B\u53E5")}</div><label class="small" style="display:block;margin-top:10px"><input id="importOverwrite" type="checkbox" style="width:auto"> \u5DF2\u5B58\u5728\u5355\u8BCD\uFF1A\u7528\u672C\u6B21\u975E\u7A7A\u5B57\u6BB5\u8986\u76D6\u65E7\u91CA\u4E49/\u8BCD\u6027/\u5B9A\u4E49</label><div class="error-compact" style="margin-top:10px">${valid.slice(0, 10).map((r) => `<div class="error-row"><span class="en">${esc(r.en)}</span><span class="zh">${esc(r.zh || "\u2014")}</span><span class="small">${esc(r.source || "")}</span></div>`).join("") || '<div class="empty">\u6CA1\u6709\u53EF\u5BFC\u5165\u884C</div>'}</div><div class="row" style="margin-top:12px"><button id="confirmImportDraft" class="primary" ${valid.length ? "" : "disabled"}>\u786E\u8BA4\u5BFC\u5165 \xB7 ${valid.length}</button></div></section>`;
}
function bindImportPreview() {
  if (!importDraft) return;
  document.getElementById("cancelImportDraft").onclick = () => {
    importDraft = null;
    renderLibrary();
  };
  document.querySelectorAll("[data-import-field]").forEach((el) => el.onchange = () => {
    importDraft.map[el.dataset.importField] = Number(el.value);
    renderLibrary();
  });
  document.getElementById("confirmImportDraft").onclick = () => {
    const overwrite = document.getElementById("importOverwrite").checked;
    const rows = recordsFromDraft(importDraft, importDraft.map).filter((r) => r.valid);
    let added = 0, updated = 0;
    for (const row of rows) {
      const existed = state.words.some((w) => w.en === String(row.en).trim().toLowerCase());
      if (/错题|错词|error/i.test(row.source)) registerErrorBook(row.source);
      upsertWord({ ...row, overwrite });
      existed ? updated++ : added++;
    }
    persist();
    importDraft = null;
    toast(`\u5BFC\u5165\u5B8C\u6210\uFF1A\u65B0\u589E ${added} \xB7 \u5DF2\u5B58\u5728 ${updated}`);
    renderLibrary();
  };
}
function freeProgressMap() {
  state.settings.freeListenProgress = state.settings.freeListenProgress && typeof state.settings.freeListenProgress === "object" ? state.settings.freeListenProgress : {};
  return state.settings.freeListenProgress;
}
function saveFreeProgress() {
  if (!freeListen) return;
  freeProgressMap()[freeListen.book] = { scope: freeListen.scope, limit: freeListen.limit, index: freeListen.index, updatedAt: Date.now() };
  persist();
}
function startFreeListen(book, { scope = "all", limit = 0, resume = false } = {}) {
  if (!book) return toast("\u5148\u9009\u62E9\u4E00\u672C\u5177\u4F53\u8BCD\u4E66");
  const ids = freeListenCandidates(state, book, { scope, limit });
  if (!ids.length) return toast(scope === "unheard" ? "\u8FD9\u672C\u8BCD\u4E66\u6CA1\u6709\u201C\u4ECE\u672A\u6B63\u5F0F\u542C\u8FC7\u201D\u7684\u8BCD" : "\u8FD9\u672C\u8BCD\u4E66\u6CA1\u6709\u53EF\u81EA\u7531\u542C\u7684\u8BCD");
  const saved = freeProgressMap()[book];
  let index = resume && saved && saved.scope === scope && Number(saved.limit || 0) === Number(limit || 0) ? Math.max(0, Math.min(ids.length - 1, Number(saved.index) || 0)) : 0;
  freeListen = { book, ids, index, scope, limit: Number(limit) || 0, revealed: false, result: null, bad: [] };
  saveFreeProgress();
  renderFreeListen();
  speak(wordById(ids[index]).en);
}
function freeListenCurrent() {
  return wordById(freeListen?.ids?.[freeListen.index]);
}
function renderFreeListen() {
  const w = freeListenCurrent();
  if (!freeListen || !w) return finishFreeListen();
  root.innerHTML = `<main class="immersive"><div class="studytop"><button id="freeBack" class="back">\u2039</button><div class="studyprogress">\u81EA\u7531\u542C \xB7 ${esc(freeListen.book)} \xB7 ${freeListen.index + 1}/${freeListen.ids.length}</div><div></div></div><div class="studybody"><div class="small">\u672C\u6A21\u5F0F\u4E0D\u5199\u5165 FSRS\u3001\u4E0D\u5360\u4ECA\u65E5\u8BA1\u5212\uFF1B\u9000\u51FA\u540E\u53EF\u4EE5\u4ECE\u672C\u4E66\u4E0A\u6B21\u4F4D\u7F6E\u7EE7\u7EED\u3002</div><button id="freeSpeak" class="speaker">\u25D6))</button>${freeListen.revealed ? `<div class="word ${freeListen.result === "good" ? "good" : "bad"}">${esc(w.en)}</div><div class="meaning">${esc(w.zh || "\u6682\u65E0\u4E2D\u6587\u91CA\u4E49")}</div><div class="move"><button id="freePrev" class="soft" ${freeListen.index === 0 ? "disabled" : ""}>\u4E0A\u4E00\u8BCD</button><button id="freeReplay" class="soft">\u91CD\u542C</button><button id="freeNext" class="primary">\u4E0B\u4E00\u8BCD</button></div>` : `<div class="small">\u610F\u601D\u80FD\u4E0D\u80FD\u76F4\u63A5\u51FA\u6765\uFF1F</div><div class="judges"><button id="freeGood" class="goodbtn">\u719F\u6089</button><button id="freeBad" class="badbtn">\u4E0D\u719F\u6089</button></div>`}</div></main>`;
  document.getElementById("freeBack").onclick = () => {
    saveFreeProgress();
    freeListen = null;
    view = "library";
    renderLibrary();
  };
  document.getElementById("freeSpeak").onclick = () => speak(w.en);
  if (!freeListen.revealed) {
    document.getElementById("freeGood").onclick = () => {
      freeListen.result = "good";
      freeListen.revealed = true;
      renderFreeListen();
    };
    document.getElementById("freeBad").onclick = () => {
      freeListen.result = "bad";
      freeListen.revealed = true;
      if (!freeListen.bad.includes(w.id)) freeListen.bad.push(w.id);
      renderFreeListen();
    };
  } else {
    document.getElementById("freeReplay").onclick = () => speak(w.en);
    document.getElementById("freePrev").onclick = () => {
      if (freeListen.index <= 0) return;
      freeListen.index--;
      freeListen.revealed = false;
      freeListen.result = null;
      saveFreeProgress();
      renderFreeListen();
      speak(freeListenCurrent().en);
    };
    document.getElementById("freeNext").onclick = () => {
      freeListen.index++;
      freeListen.revealed = false;
      freeListen.result = null;
      if (freeListen.index >= freeListen.ids.length) finishFreeListen();
      else {
        saveFreeProgress();
        renderFreeListen();
        speak(freeListenCurrent().en);
      }
    };
  }
}
function addFreeBadToToday(ids) {
  const date = currentDayKey();
  const books = state.settings.todayBooks || [];
  let plan = ensureDailyPlan(state, planForTodayOptions(date, books));
  if (plan.mode === "sequential") return toast("\u5F53\u524D\u662F\u5206\u672C\u4F9D\u6B21\u8BA1\u5212\uFF0C\u8BF7\u5728\u4ECA\u65E5\u9875\u8C03\u6574\u540E\u518D\u52A0\u5165");
  let marked = 0;
  for (const id3 of ids) {
    const w = wordById(id3);
    if (!w || !matchesBooks(w, books)) continue;
    w.reviewHint = true;
    marked++;
  }
  plan = ensureDailyPlan(state, { date, books });
  let added = 0;
  for (const id3 of ids) {
    const w = wordById(id3);
    if (!w || !matchesBooks(w, books)) continue;
    plan.newIds = plan.newIds.filter((x) => x !== id3);
    if (!plan.reviewIds.includes(id3)) {
      plan.reviewIds.push(id3);
      added++;
    }
  }
  plan.reviewTarget = Math.max(plan.reviewTarget, plan.reviewIds.length);
  plan.updatedAt = Date.now();
  persist();
  toast(marked ? `\u5DF2\u4F5C\u4E3A\u590D\u4E60\u8BCD\u52A0\u5165\u4ECA\u65E5\u8BA1\u5212 ${added} \u4E2A` : "\u8FD9\u4E9B\u4E0D\u719F\u8BCD\u4E0D\u5728\u5F53\u524D\u4ECA\u65E5\u8BCD\u4E66\u8303\u56F4");
}
function finishFreeListen() {
  if (!freeListen) return;
  const run = freeListen;
  const bad = [...run.bad];
  freeProgressMap()[run.book] = { scope: run.scope, limit: run.limit, index: 0, updatedAt: Date.now(), completedAt: Date.now() };
  persist();
  root.innerHTML = `<main class="immersive"><div class="studybody"><div class="finish"><div class="small">\u81EA\u7531\u542C\u5B8C\u6210 \xB7 \u4E0D\u5F71\u54CD FSRS</div><h2>${esc(run.book)}</h2><div class="grid3" style="margin:18px 0"><div class="statbox"><b>${run.ids.length}</b><span>\u672C\u8F6E\u8BCD\u6570</span></div><div class="statbox"><b class="bad">${bad.length}</b><span>\u672C\u8F6E\u4E0D\u719F</span></div><div class="statbox"><b>${run.ids.length - bad.length}</b><span>\u5176\u4F59\u719F\u6089</span></div></div><div class="row" style="justify-content:center">${bad.length ? `<button id="freeToType" class="primary">\u624B\u6253\u8FD9\u6279 \xB7 ${bad.length}</button><button id="freeToToday" class="soft">\u52A0\u5165\u4ECA\u65E5\u8BA1\u5212</button>` : ""}<button id="freeFinish" class="ghost">\u8FD4\u56DE\u8BCD\u5E93</button></div></div></div></main>`;
  if (document.getElementById("freeToType")) document.getElementById("freeToType").onclick = () => {
    freeListen = null;
    view = "type";
    startType(bad, `${run.book} \xB7 \u81EA\u7531\u542C\u4E0D\u719F`);
  };
  if (document.getElementById("freeToToday")) document.getElementById("freeToToday").onclick = () => addFreeBadToToday(bad);
  document.getElementById("freeFinish").onclick = () => {
    freeListen = null;
    view = "library";
    renderLibrary();
  };
}
function freeListenSetupHtml(books) {
  const progress = freeProgressMap();
  return `<section class="card"><div class="space"><div><h2 class="section-title">\u81EA\u7531\u542C\u8BCD\u4E66</h2><div class="small">\u5BFC\u5165\u4E00\u6574\u672C\u540E\u53EF\u4EE5\u76F4\u63A5\u4ECE\u5934\u6328\u4E2A\u542C\uFF0C\u4E0D\u5360\u4ECA\u65E5\u65B0\u8BCD/\u590D\u4E60\uFF0C\u4E5F\u4E0D\u4F1A\u4FEE\u6539 FSRS\u3002</div></div></div><div class="filtergrid" style="margin-top:12px"><div class="field"><label>\u8BCD\u4E66</label><select id="freeListenSelect"><option value="">\u8BF7\u9009\u62E9</option>${books.map((b) => `<option value="${esc(b)}">${esc(b)}</option>`).join("")}</select></div><div class="field"><label>\u8303\u56F4</label><select id="freeListenScope"><option value="all">\u6574\u672C</option><option value="unheard">\u53EA\u542C\u4ECE\u672A\u6B63\u5F0F\u542C\u8FC7</option></select></div><div class="field"><label>\u672C\u8F6E\u6570\u91CF</label><select id="freeListenLimit"><option value="50">50</option><option value="100">100</option><option value="0">\u5168\u90E8</option></select></div><label class="small" style="align-self:end"><input id="freeListenResume" type="checkbox" checked style="width:auto"> \u6709\u8BB0\u5F55\u65F6\u4ECE\u4E0A\u6B21\u4F4D\u7F6E\u7EE7\u7EED</label></div><div id="freeListenHint" class="small" style="margin-top:9px"></div><div class="row" style="margin-top:10px"><button id="startFreeListen" class="primary">\u5F00\u59CB\u81EA\u7531\u542C</button></div></section>`;
}
function bindFreeListenSetup() {
  const select = document.getElementById("freeListenSelect"), hint = document.getElementById("freeListenHint");
  if (!select) return;
  const draw = () => {
    const book = select.value, saved = freeProgressMap()[book];
    hint.textContent = saved && Number(saved.index) > 0 ? `\u4E0A\u6B21\u505C\u5728\u7B2C ${Number(saved.index) + 1} \u4E2A\uFF1B\u52FE\u9009\u201C\u7EE7\u7EED\u201D\u5373\u53EF\u63A5\u7740\u542C\u3002` : "\u81EA\u7531\u542C\u6309\u5F53\u524D\u8BCD\u5E93\u5019\u9009\u987A\u5E8F\u64AD\u653E\uFF1B\u672C\u8F6E\u4E0D\u719F\u53EF\u52A0\u5165\u4ECA\u65E5\u590D\u4E60\u3002";
  };
  select.onchange = draw;
  draw();
  document.getElementById("startFreeListen").onclick = () => startFreeListen(select.value, { scope: document.getElementById("freeListenScope").value, limit: Number(document.getElementById("freeListenLimit").value) || 0, resume: document.getElementById("freeListenResume").checked });
}
function wordbookManageHtml(books) {
  return `<section class="card"><div class="space"><div><h2 class="section-title">\u8BCD\u4E66\u7BA1\u7406</h2><div class="small">\u5220\u9664\u8BCD\u4E66\u65F6\u53EF\u4EE5\u53EA\u79FB\u9664\u8BCD\u4E66\u5F52\u5C5E\uFF0C\u4E5F\u53EF\u4EE5\u540C\u65F6\u5F7B\u5E95\u5220\u9664\u53EA\u5C5E\u4E8E\u8FD9\u672C\u4E66\u7684\u5355\u8BCD\u548C\u5B66\u4E60\u8BB0\u5F55\uFF1B\u5171\u4EAB\u8BCD\u4E0D\u4F1A\u8BEF\u5220\u3002</div></div></div><div class="error-compact" style="margin-top:10px">${books.map((book) => {
    const words = state.words.filter((w) => (w.sources || []).includes(book));
    const exclusive = words.filter((w) => (w.sources || []).length === 1).length;
    const shared = words.length - exclusive;
    return `<div class="error-row"><span><b>${esc(book)}</b><div class="small">${words.length} \u8BCD \xB7 \u72EC\u5360 ${exclusive} \xB7 \u5171\u4EAB ${shared}</div></span><span></span><button class="danger" data-delete-book="${esc(book)}">\u5220\u9664\u8BCD\u4E66</button></div>`;
  }).join("") || '<div class="empty">\u8FD8\u6CA1\u6709\u8BCD\u4E66\u3002</div>'}</div></section>`;
}
function bindWordbookManage() {
  document.querySelectorAll("[data-delete-book]").forEach((button) => button.onclick = () => {
    const book = button.dataset.deleteBook;
    const words = state.words.filter((w) => (w.sources || []).includes(book));
    const exclusive = words.filter((w) => (w.sources || []).length === 1).length;
    const shared = words.length - exclusive;
    const purge = confirm(`\u5220\u9664\u8BCD\u4E66\u300C${book}\u300D\uFF1F

\u786E\u5B9A\uFF1A\u5220\u9664\u8BCD\u4E66\uFF0C\u5E76\u5F7B\u5E95\u5220\u9664\u5176\u4E2D ${exclusive} \u4E2A\u72EC\u5360\u5355\u8BCD\u53CA\u5176\u5B66\u4E60\u8BB0\u5F55\u3002
\u53D6\u6D88\uFF1A\u4E0B\u4E00\u6B65\u53EF\u9009\u62E9\u4EC5\u79FB\u9664\u8BCD\u4E66\u5E76\u4FDD\u7559\u5168\u90E8\u5B66\u4E60\u6570\u636E\u3002

\u5171\u4EAB\u8BCD ${shared} \u4E2A\u53EA\u4F1A\u79FB\u9664\u8FD9\u672C\u4E66\u7684\u5F52\u5C5E\uFF0C\u4E0D\u4F1A\u5220\u9664\u5176\u4ED6\u8BCD\u4E66\u4E2D\u7684\u5355\u8BCD\u548C\u5386\u53F2\u3002`);
    if (!purge) {
      if (!confirm(`\u4EC5\u79FB\u9664\u8BCD\u4E66\u300C${book}\u300D\uFF0C\u4FDD\u7559\u5355\u8BCD\u548C\u5168\u90E8\u5B66\u4E60\u6570\u636E\uFF1F`)) return;
    }
    const result = deleteWordbook(state, book, { purgeExclusive: purge });
    persist();
    toast(purge ? `\u5DF2\u5220\u9664\u8BCD\u4E66\uFF1A\u5F7B\u5E95\u5220\u9664 ${result.removedWords} \u4E2A\u72EC\u5360\u8BCD` : "\u5DF2\u79FB\u9664\u8BCD\u4E66\uFF0C\u5B66\u4E60\u6570\u636E\u5DF2\u4FDD\u7559");
    renderLibrary();
  });
}
function renderLibrary() {
  const books = allBooks(state);
  shell(`<div class="stack"><section class="card hero"><div class="space"><div><h2>\u8BCD\u5E93</h2><p>\u5355\u8BCD\u53EA\u4FDD\u5B58\u4E00\u4EFD\uFF1B\u4E00\u672C\u8BCD\u53EF\u4EE5\u540C\u65F6\u5C5E\u4E8E\u591A\u4E2A\u8BCD\u4E66\u3002</p></div><span class="tag">${state.words.length} \u8BCD</span></div><div class="toolbar" style="margin-top:14px"><button id="importWords" class="primary">\u5BFC\u5165 CSV / TXT</button><button id="backupWords" class="soft">\u5B8C\u6574\u5907\u4EFD</button><button id="restoreWords" class="soft">\u6062\u590D\u5907\u4EFD</button></div><details class="details"><summary>\u590D\u4E60\u4E0E\u6717\u8BFB\u8BBE\u7F6E</summary><div class="grid2" style="margin-top:12px"><div class="field"><label>FSRS \u671F\u671B\u8BB0\u5FC6\u4FDD\u6301\u7387</label><input id="retention" type="number" min="0.75" max="0.97" step="0.01" value="${state.settings.retention}"></div><div class="field"><label>\u6717\u8BFB\u8BED\u901F</label><input id="speechRate" type="number" min="0.5" max="1.5" step="0.05" value="${state.settings.speechRate}"></div></div><div class="small" style="margin-top:8px">\u8C03\u5EA6\u6838\u5FC3\uFF1A${FSRS_VERSION}\u3002\u4FEE\u6539\u4FDD\u6301\u7387\u4F1A\u6309\u5386\u53F2\u9996\u8F6E\u8BB0\u5F55\u91CD\u65B0\u8BA1\u7B97\u5361\u7247\u72B6\u6001\u3002</div></details></section>${wordbookManageHtml(books)}${freeListenSetupHtml(books)}${errorBookSectionHtml()}${pendingMeaningHtml()}${wordEditorHtml()}${importPreviewHtml()}<section class="card"><div class="space"><div><h2 class="section-title">\u5168\u90E8\u8BCD\u5E93</h2><div class="small">\u666E\u901A\u5217\u8868\u4E5F\u6539\u6210\u7D27\u51D1\u663E\u793A\uFF0C\u907F\u514D\u8BCD\u591A\u65F6\u4E00\u5C4F\u53EA\u80FD\u770B\u5230\u51E0\u4E2A\u3002</div></div></div><div class="grid2" style="margin-top:12px"><input id="wordSearch" placeholder="\u641C\u7D22\u5355\u8BCD\u6216\u91CA\u4E49"><select id="wordBook"><option value="">\u5168\u90E8\u8BCD\u4E66</option>${books.map((b) => `<option>${esc(b)}</option>`).join("")}</select></div><div id="wordList" class="list" style="margin-top:12px"></div></section></div>`);
  document.getElementById("importWords").onclick = () => importInput.click();
  document.getElementById("backupWords").onclick = backup;
  document.getElementById("restoreWords").onclick = () => restoreInput.click();
  document.getElementById("wordSearch").oninput = drawWordList;
  document.getElementById("wordBook").onchange = drawWordList;
  document.querySelectorAll("[data-open-error-book]").forEach((button) => button.onclick = () => {
    document.getElementById("wordBook").value = button.dataset.openErrorBook;
    drawWordList();
    document.getElementById("wordList").scrollIntoView({ behavior: "smooth", block: "start" });
  });
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
  bindWordbookManage();
  bindFreeListenSetup();
  drawWordList();
  bindPendingMeanings();
  bindWordEditor();
  bindImportPreview();
}
function drawWordList() {
  const box = document.getElementById("wordList");
  if (!box) return;
  const q = document.getElementById("wordSearch").value.trim().toLowerCase(), book = document.getElementById("wordBook").value;
  const list = state.words.filter((w) => (!book || w.sources.includes(book)) && (!q || `${w.en} ${w.zh}`.toLowerCase().includes(q))).slice(0, 200);
  box.innerHTML = list.length ? list.map((w) => `<div class="listitem compact-word"><div class="space"><div style="min-width:0"><div class="word-main"><b>${esc(w.en)}</b>${w.retired ? '<span class="tag">\u7B80\u5355</span>' : ""}<span class="word-meaning">${esc(w.zh || "")}</span></div><div class="source-tags" style="justify-content:flex-start">${w.sources.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}</div></div><div class="row"><button class="ghost" data-edit-word="${w.id}">\u7F16\u8F91</button><button class="soft" data-retire="${w.id}">${w.retired ? "\u6062\u590D" : "\u7B80\u5355"}</button><button class="danger" data-delete-word="${w.id}">\u5220\u9664</button></div></div></div>`).join("") : '<div class="empty">\u6CA1\u6709\u5339\u914D\u7684\u8BCD\u3002</div>';
  document.querySelectorAll("[data-retire]").forEach((b) => b.onclick = () => {
    const w = wordById(b.dataset.retire);
    markSimpleLexeme(state, w.en, !w.retired);
    persist();
    drawWordList();
  });
  document.querySelectorAll("[data-edit-word]").forEach((b) => b.onclick = () => {
    wordEditId = b.dataset.editWord;
    renderLibrary();
  });
  document.querySelectorAll("[data-delete-word]").forEach((b) => b.onclick = () => {
    const w = wordById(b.dataset.deleteWord);
    if (!w || !confirm(`\u5F7B\u5E95\u5220\u9664\u300C${w.en}\u300D\uFF1F\u5B66\u4E60\u5386\u53F2\u548C\u4ECA\u65E5\u8BA1\u5212\u5F15\u7528\u4E5F\u4F1A\u5220\u9664\u3002`)) return;
    deleteWordEverywhere(state, w.id);
    persist();
    toast("\u5DF2\u5220\u9664\u5355\u8BCD");
    renderLibrary();
  });
}
function backup() {
  download(`listenwrite-backup-${currentDayKey()}.json`, exportState(state));
}
function filteredEvents() {
  if (!statRange) return state.events;
  const key = addStudyDays(currentDayKey(), -statRange + 1);
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
  const first = new Date(Date.UTC(statMonth.getUTCFullYear(), statMonth.getUTCMonth(), 1, 12)), last = new Date(Date.UTC(statMonth.getUTCFullYear(), statMonth.getUTCMonth() + 1, 0, 12)), offset = (first.getUTCDay() + 6) % 7, start = new Date(first);
  start.setUTCDate(first.getUTCDate() - offset);
  const tail = 6 - (last.getUTCDay() + 6) % 7, end = new Date(last);
  end.setUTCDate(last.getUTCDate() + tail);
  const cells = [];
  let max = 1;
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const key = calendarKey(d), n = activity[key] || 0;
    max = Math.max(max, n);
    cells.push({ key, n, date: new Date(d), same: d.getUTCMonth() === first.getUTCMonth() });
  }
  return `<section class="card"><div class="space"><div><h2 class="section-title">\u5B66\u4E60\u65E5\u5386</h2><div class="small">${studyDayLabel()}\u3002\u53EF\u4EE5\u4E00\u76F4\u5F80\u524D\u7FFB\uFF0C\u70B9\u65E5\u671F\u770B\u5177\u4F53\u8BB0\u5F55\u3002</div></div></div><div class="calendarbar"><button id="calPrev">\u2039</button><div><b>${first.getUTCFullYear()} \u5E74 ${first.getUTCMonth() + 1} \u6708</b></div><button id="calNext">\u203A</button></div><div class="week"><span>\u4E00</span><span>\u4E8C</span><span>\u4E09</span><span>\u56DB</span><span>\u4E94</span><span>\u516D</span><span>\u65E5</span></div><div class="calgrid">${cells.map((c) => {
    const future = c.key > currentDayKey(), op = c.n ? 0.14 + 0.62 * c.n / max : 0.04;
    return `<button class="day ${c.key === statDay ? "sel " : ""}${c.same ? "" : "other "}${future ? "future" : ""}" data-stat-day="${c.key}" ${future ? "disabled" : ""} style="background:rgba(93,119,99,${op.toFixed(2)})"><span>${c.date.getUTCDate()}</span>${c.n ? `<strong>${c.n}</strong>` : ""}</button>`;
  }).join("")}</div><div style="text-align:center;margin-top:8px"><button id="calToday" class="ghost">\u56DE\u5230\u672C\u6708</button></div></section>`;
}
function bindCalendar() {
  document.getElementById("calPrev").onclick = () => {
    statMonth = new Date(Date.UTC(statMonth.getUTCFullYear(), statMonth.getUTCMonth() - 1, 1, 12));
    renderStats();
  };
  document.getElementById("calNext").onclick = () => {
    const n = new Date(Date.UTC(statMonth.getUTCFullYear(), statMonth.getUTCMonth() + 1, 1, 12)), cur = calendarDate(currentDayKey());
    cur.setUTCDate(1);
    if (n <= cur) {
      statMonth = n;
      renderStats();
    }
  };
  document.getElementById("calToday").onclick = () => {
    statDay = currentDayKey();
    statMonth = calendarDate(statDay);
    renderStats();
  };
  document.querySelectorAll("[data-stat-day]").forEach((b) => b.onclick = () => {
    statDay = b.dataset.statDay;
    statMonth = calendarDate(statDay);
    renderStats();
  });
}
function dayDetailHtml() {
  const ev = state.events.filter((e) => e.date === statDay).sort((a, b) => a.ts - b.ts), ids = [...new Set(ev.map((e) => e.wordId))];
  const rows = ids.map((id3) => {
    const w = wordById(id3), a = ev.filter((e) => e.wordId === id3), first = a.find((e) => e.cold) || a[0], bad = a.filter((e) => e.result === "bad").length, l = a.filter((e) => e.mode === "listen").length, t = a.filter((e) => e.mode === "type").length;
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
  const hard = [...map.entries()].map(([id3, g]) => {
    const w = wordById(id3);
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
    if (freeListen) return renderFreeListen();
    if (listen) return renderListen();
    if (typeRun) return renderTypeRun();
    if (sentenceRun) return renderSentenceRun();
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
  importDraft = buildImportDraft(await f.text(), f.name);
  wordEditId = null;
  view = "library";
  renderLibrary();
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
  statDay = currentDayKey();
  statMonth = calendarDate(statDay);
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
