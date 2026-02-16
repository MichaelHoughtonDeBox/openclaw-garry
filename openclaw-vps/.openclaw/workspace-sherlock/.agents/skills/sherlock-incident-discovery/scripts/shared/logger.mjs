const COLORS = {
  reset: "\u001b[0m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
  magenta: "\u001b[35m"
};

function write(stream, color, scope, message, payload) {
  const prefix = `${COLORS[color]}[${scope}]${COLORS.reset}`;
  if (payload === undefined) {
    stream.write(`${prefix} ${message}\n`);
    return;
  }
  stream.write(`${prefix} ${message} ${JSON.stringify(payload)}\n`);
}

export function createLogger(scope) {
  return {
    info(message, payload) {
      write(process.stdout, "cyan", scope, message, payload);
    },
    success(message, payload) {
      write(process.stdout, "green", scope, message, payload);
    },
    warn(message, payload) {
      write(process.stdout, "yellow", scope, message, payload);
    },
    error(message, payload) {
      write(process.stderr, "red", scope, message, payload);
    },
    debug(message, payload) {
      write(process.stdout, "magenta", scope, message, payload);
    }
  };
}
