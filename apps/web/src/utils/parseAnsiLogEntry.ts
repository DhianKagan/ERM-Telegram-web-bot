// Назначение файла: разбор ANSI-строк логов WG Log Engine
// Модули: регулярные выражения

export interface ParsedLog {
  level: string;
  time?: string;
  method?: string;
  status?: number;
  endpoint?: string;
  csrf?: boolean;
  message: string;
}

const ESC = '\u001b';
const ansiRegex = new RegExp(`${ESC}\\[[0-9;]*m`, 'g');

export default function parseAnsiLogEntry(line: string): ParsedLog {
  const clean = line.replace(ansiRegex, '');
  const match = clean.match(/^(\w+)\s+\[(.+?)\]\s+(.*)$/);
  const res: ParsedLog = {
    level: match ? match[1].toLowerCase() : 'info',
    time: match ? match[2] : undefined,
    message: match ? match[3] : clean,
  };
  const msg = res.message;
  let m;
  if ((m = msg.match(/API запрос (\w+) (\S+) token:([^ ]+) csrf:([^ ]+)/))) {
    res.method = m[1];
    res.endpoint = m[2];
    res.csrf = m[4] !== 'no-csrf';
  } else if ((m = msg.match(/API запрос (\w+) (\S+) (\w+) (\w+)/))) {
    res.method = m[1];
    res.endpoint = m[2];
    res.csrf = m[4] !== 'no-csrf';
  } else if ((m = msg.match(/API ответ (\w+) (\S+) (\d+)/))) {
    res.method = m[1];
    res.endpoint = m[2];
    res.status = Number(m[3]);
  }
  return res;
}
