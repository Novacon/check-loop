/** Strict `--key value` / `--key=value` / `--flag` parser. Unknown or malformed options throw. */
export function parseArgs(argv, { valueOptions = [], booleanOptions = [] } = {}, command = "") {
  const values = new Set(valueOptions);
  const flags = new Set(booleanOptions);
  const options = {};
  const label = command ? `${command} ` : "";

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected ${label}argument: ${JSON.stringify(token)}.`);
    }
    const equalsIndex = token.indexOf("=");
    const key = token.slice(2, equalsIndex === -1 ? undefined : equalsIndex);
    if (!values.has(key) && !flags.has(key)) {
      throw new Error(`Unknown ${label}option: --${key}.`);
    }
    if (key in options) {
      throw new Error(`Duplicate ${label}option: --${key}.`);
    }
    if (flags.has(key)) {
      if (equalsIndex !== -1) throw new Error(`Option --${key} does not take a value.`);
      options[key] = true;
      continue;
    }
    if (equalsIndex !== -1) {
      options[key] = token.slice(equalsIndex + 1);
      continue;
    }
    const next = argv[index + 1];
    if (next === undefined || (next.startsWith("-") && next !== "-")) {
      throw new Error(`Missing value for --${key}.`);
    }
    options[key] = next;
    index += 1;
  }
  return options;
}
