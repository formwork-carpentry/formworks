/**
 * @module @formwork/faker
 * @description Deterministic fake data helpers for factories, seeders, and tests.
 */
const FIRST_NAMES = ["Ada", "Grace", "Linus", "Margaret", "Evelyn", "James", "Maya", "Nina"];
const LAST_NAMES = [
    "Lovelace",
    "Hopper",
    "Torvalds",
    "Hamilton",
    "Stone",
    "Carter",
    "Diaz",
    "Cole",
];
const COMPANY_PREFIXES = [
    "North",
    "Bright",
    "Blue",
    "Prime",
    "Summit",
    "Anchor",
    "Atlas",
    "Signal",
];
const COMPANY_SUFFIXES = [
    "Works",
    "Labs",
    "Systems",
    "Studio",
    "Partners",
    "Cloud",
    "Dynamics",
    "Collective",
];
const EMAIL_PROVIDERS = ["example.test", "mail.test", "formwork.dev", "carpenter.app"];
const LOREM_WORDS = [
    "amber",
    "river",
    "stone",
    "forest",
    "signal",
    "harbor",
    "field",
    "cinder",
    "paper",
    "marble",
    "echo",
    "canvas",
];
function hashSeed(seed) {
    if (typeof seed === "number") {
        return seed >>> 0;
    }
    let value = 2166136261;
    for (let i = 0; i < seed.length; i++) {
        value ^= seed.charCodeAt(i);
        value = Math.imul(value, 16777619);
    }
    return value >>> 0;
}
function normalizeWord(value) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ".")
        .replace(/^\.+|\.+$/g, "");
}
export class FakerManager {
    state;
    currentLocale = "en";
    sequenceIndex = 0;
    uniqueness = new Set();
    helpers = {
        arrayElement: (values) => {
            if (values.length === 0) {
                throw new Error("Cannot pick an element from an empty array.");
            }
            return values[this.number.int({ min: 0, max: values.length - 1 })];
        },
        maybe: (producer, probability = 0.5) => {
            return this.next() <= probability ? producer() : null;
        },
    };
    number = {
        int: (options = {}) => {
            const min = options.min ?? 0;
            const max = options.max ?? 9999;
            if (max < min) {
                throw new Error(`Invalid integer range: ${min}..${max}`);
            }
            const span = max - min + 1;
            return min + Math.floor(this.next() * span);
        },
    };
    string = {
        uuid: () => {
            const hex = () => this.number.int({ min: 0, max: 0xffff }).toString(16).padStart(4, "0");
            return `${hex()}${hex()}-${hex()}-${hex()}-${hex()}-${hex()}${hex()}${hex()}`;
        },
        slug: (value) => {
            const base = value ?? this.lorem.words(2);
            return base
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")
                .replace(/^-+|-+$/g, "");
        },
    };
    person = {
        firstName: () => this.helpers.arrayElement(FIRST_NAMES),
        lastName: () => this.helpers.arrayElement(LAST_NAMES),
        fullName: () => `${this.person.firstName()} ${this.person.lastName()}`,
    };
    company = {
        name: () => `${this.helpers.arrayElement(COMPANY_PREFIXES)} ${this.helpers.arrayElement(COMPANY_SUFFIXES)}`,
    };
    internet = {
        username: (options = {}) => {
            const first = normalizeWord(options.firstName ?? this.person.firstName());
            const last = normalizeWord(options.lastName ?? this.person.lastName());
            return `${first}.${last}${this.number.int({ min: 1, max: 999 })}`;
        },
        email: (options = {}) => {
            const provider = normalizeWord(options.provider ?? this.helpers.arrayElement(EMAIL_PROVIDERS));
            return `${this.internet.username(options)}@${provider}`;
        },
    };
    lorem = {
        word: () => this.helpers.arrayElement(LOREM_WORDS),
        words: (count = 3) => Array.from({ length: count }, () => this.lorem.word()).join(" "),
        sentence: (count = 6) => {
            const sentence = this.lorem.words(count);
            return `${sentence.charAt(0).toUpperCase() + sentence.slice(1)}.`;
        },
    };
    date = {
        between: ({ from, to }) => {
            const start = from.getTime();
            const end = to.getTime();
            if (end < start) {
                throw new Error("Date range end must be greater than or equal to start.");
            }
            return new Date(start + Math.floor(this.next() * (end - start + 1)));
        },
    };
    constructor(seed = 12345) {
        this.state = hashSeed(seed);
    }
    seed(seed) {
        this.state = hashSeed(seed);
        this.sequenceIndex = 0;
        this.uniqueness.clear();
        return this;
    }
    withSeed(seed) {
        return new FakerManager(seed).locale(this.currentLocale);
    }
    locale(value) {
        if (value === undefined) {
            return this.currentLocale;
        }
        this.currentLocale = value;
        return this;
    }
    sequence(producer) {
        this.sequenceIndex += 1;
        return producer ? producer(this.sequenceIndex) : this.sequenceIndex;
    }
    unique(producer, maxAttempts = 100) {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const value = producer();
            const key = JSON.stringify(value);
            if (!this.uniqueness.has(key)) {
                this.uniqueness.add(key);
                return value;
            }
        }
        throw new Error(`Unable to produce a unique value after ${maxAttempts} attempts.`);
    }
    resetUnique() {
        this.uniqueness.clear();
        return this;
    }
    next() {
        this.state += 0x6d2b79f5;
        let value = this.state;
        value = Math.imul(value ^ (value >>> 15), value | 1);
        value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    }
}
export function createFaker(seed) {
    return new FakerManager(seed);
}
export function fake(seed) {
    return createFaker(seed);
}
//# sourceMappingURL=index.js.map