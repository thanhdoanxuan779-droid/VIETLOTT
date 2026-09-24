const SOURCE = "https://xoso.com.vn";

const MEGA_KEY = "VIETLOTT_MEGA645";
const POWER_KEY = "VIETLOTT_POWER655";

const MAX_SOURCE_REQUESTS = 50;

const GAMES = {
  mega645: {
    name: "MEGA 6/45",
    count: 6,
    max: 45,
    path: "xo-so-mega-ngay-",
    cutoff: "2018-01-03",
    weekdays: [0, 3, 5]
  },

  power655: {
    name: "POWER 6/55",
    count: 7,
    max: 55,
    path: "xo-so-power-655-ngay-",
    cutoff: "2018-02-01",
    weekdays: [2, 4, 6]
  }
};

function kvKey(game) {
  return game === "mega645"
    ? MEGA_KEY
    : POWER_KEY;
}


/* =========================================================
   BASIC
   ========================================================= */

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  };
}

function json(data, status = 200) {
  return new Response(
    JSON.stringify(data),
    {
      status,
      headers: corsHeaders()
    }
  );
}

function todayVN() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }
  ).format(new Date());
}

function isoToDMY(iso) {
  const [y, m, d] =
    iso.split("-");

  return `${d}-${m}-${y}`;
}

function addDays(iso, amount) {
  const d =
    new Date(
      `${iso}T00:00:00Z`
    );

  d.setUTCDate(
    d.getUTCDate() + amount
  );

  return d
    .toISOString()
    .slice(0, 10);
}

function isValidISODate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(value || "")
  );
}

function weekdayOf(iso) {
  const [y, m, d] =
    iso.split("-").map(Number);

  return new Date(
    Date.UTC(
      y,
      m - 1,
      d
    )
  ).getUTCDay();
}

function isDrawDay(game, date) {
  return GAMES[game]
    .weekdays
    .includes(
      weekdayOf(date)
    );
}

function sourceUrl(game, date) {
  const cfg =
    GAMES[game];

  return `${SOURCE}/${cfg.path}${isoToDMY(date)}.html`;
}


/* =========================================================
   HTML CLEAN
   ========================================================= */

function cleanHtml(html) {
  return String(html || "")
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    )
    .replace(
      /<noscript[\s\S]*?<\/noscript>/gi,
      " "
    )
    .replace(
      /<[^>]+>/g,
      " "
    )
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&#160;/gi,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&#39;/gi,
      "'"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}


/* =========================================================
   RESULT VALIDATION
   ========================================================= */

function validNumbers(
  numbers,
  game
) {
  const cfg =
    GAMES[game];

  if (
    numbers.length !==
    cfg.count
  ) {
    return false;
  }

  if (
    numbers.some(
      n =>
        !Number.isInteger(n) ||
        n < 1 ||
        n > cfg.max
    )
  ) {
    return false;
  }

  if (
    new Set(numbers).size !==
    cfg.count
  ) {
    return false;
  }

  return true;
}

function makeResult(
  game,
  requestedDate,
  numbers
) {
  return {
    id:
      `${game}_${requestedDate}`,

    date:
      requestedDate,

    result:
      numbers,

    data:
      numbers
        .map(
          n =>
            String(n)
              .padStart(2, "0")
        )
        .join("-")
  };
}


/* =========================================================
   MEGA PARSER
   ========================================================= */

function parseMegaPage(
  text,
  requestedDate
) {
  /*
   * Tìm đúng ngày cần lấy.
   */
  const dateDMY =
    isoToDMY(requestedDate);

  const datePos =
    text.indexOf(dateDMY);

  /*
   * Nếu tìm được ngày thì bắt đầu
   * tìm từ khu vực đó.
   */
  const start =
    datePos >= 0
      ? datePos
      : 0;

  const area =
    text.slice(
      start,
      start + 3000
    );

  /*
   * Tìm kỳ quay.
   */
  const draw =
    area.match(
      /Kỳ\s+quay\s+thưởng\s*:\s*#\s*\d+/i
    );

  if (!draw) {
    return null;
  }

  const after =
    area.slice(
      draw.index +
      draw[0].length
    );

  /*
   * Mega có đúng 6 số.
   *
   * Lấy từng nhóm 6 số liên tiếp.
   */
  const matches =
    after.match(
      /\b\d{1,2}\b/g
    ) || [];

  const numbers =
    matches
      .map(Number);

  /*
   * Tìm nhóm 6 số hợp lệ đầu tiên.
   */
  for (
    let i = 0;
    i <= numbers.length - 6;
    i++
  ) {
    const candidate =
      numbers.slice(
        i,
        i + 6
      );

    if (
      validNumbers(
        candidate,
        "mega645"
      )
    ) {
      return makeResult(
        "mega645",
        requestedDate,
        candidate
      );
    }
  }

  return null;
}


/* =========================================================
   POWER PARSER
   ========================================================= */

function parsePowerPage(
  text,
  requestedDate
) {
  const dateDMY =
    isoToDMY(requestedDate);

  /*
   * Tìm đúng ngày:
   *
   * 22/09/2026
   */
  const datePos =
    text.indexOf(dateDMY);

  if (datePos < 0) {
    return null;
  }

  /*
   * Chỉ xử lý vùng của đúng ngày.
   */
  const area =
    text.slice(
      datePos,
      datePos + 3000
    );

  /*
   * Phải có POWER 6/55.
   */
  if (
    !/POWER\s*6\s*\/\s*55/i.test(
      area
    )
  ) {
    /*
     * Một số trang có phần heading
     * nằm trước ngày, nên không return
     * ngay nếu vùng này không có tên game.
     */
  }

  /*
   * Tìm đúng:
   *
   * Kỳ quay thưởng: #01401
   */
  const draw =
    area.match(
      /Kỳ\s+quay\s+thưởng\s*:\s*#\s*\d+/i
    );

  if (!draw) {
    return null;
  }

  /*
   * Phần sau kỳ quay.
   */
  const after =
    area.slice(
      draw.index +
      draw[0].length
    );

  /*
   * Lấy các số 1-2 chữ số.
   */
  const matches =
    after.match(
      /\b\d{1,2}\b/g
    ) || [];

  const numbers =
    matches.map(Number);

  /*
   * POWER có 7 số:
   *
   * 01 03 09 11 41 46 10
   *
   * Số cuối là số đặc biệt,
   * vẫn lưu chung trong result.
   */
  for (
    let i = 0;
    i <= numbers.length - 7;
    i++
  ) {
    const candidate =
      numbers.slice(
        i,
        i + 7
      );

    if (
      validNumbers(
        candidate,
        "power655"
      )
    ) {
      return makeResult(
        "power655",
        requestedDate,
        candidate
      );
    }
  }

  return null;
}


/* =========================================================
   MAIN PARSER
   ========================================================= */

function parseVietlottPage(
  html,
  game,
  requestedDate
) {
  const text =
    cleanHtml(html);

  /*
   * POWER và MEGA dùng parser
   * riêng hoàn toàn.
   */
  if (
    game === "power655"
  ) {
    return parsePowerPage(
      text,
      requestedDate
    );
  }

  if (
    game === "mega645"
  ) {
    return parseMegaPage(
      text,
      requestedDate
    );
  }

  return null;
}


/* =========================================================
   FETCH SOURCE
   ========================================================= */

async function fetchOne(
  game,
  date
) {
  const url =
    sourceUrl(
      game,
      date
    );

  try {
    /*
     * Không dùng cf.cacheEverything.
     * Thêm cache-buster để Worker lấy
     * trang nguồn mới.
     */
    const response =
      await fetch(
        url +
          "?_=" +
          Date.now(),
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; VietlottAutoWorker/1.0)",

            "Accept":
              "text/html,application/xhtml+xml"
          }
        }
      );

    if (
      !response.ok
    ) {
      return {
        found: false,
        date,
        game,
        status:
          response.status
      };
    }

    const html =
      await response.text();

    const item =
      parseVietlottPage(
        html,
        game,
        date
      );

    if (!item) {
      return {
        found: false,
        date,
        game,
        status:
          response.status
      };
    }

    return {
      found: true,
      date,
      game,
      item,
      status:
        response.status
    };

  } catch (error) {
    return {
      found: false,
      date,
      game,
      error:
        String(
          error?.message ||
          error
        )
    };
  }
}


/* =========================================================
   STORE
   ========================================================= */

function emptyGameStore() {
  return {
    version: 4,
    game: null,
    rows: [],
    cursor: null,
    backfillLocked: false,
    updatedAt: null
  };
}

function normalizeGameStore(
  value,
  game
) {
  const base =
    emptyGameStore();

  base.game =
    game;

  if (
    !value ||
    typeof value !==
      "object"
  ) {
    return base;
  }

  if (
    Array.isArray(
      value.rows
    )
  ) {
    base.rows =
      value.rows.filter(
        row =>
          row &&
          isValidISODate(
            row.date
          ) &&
          Array.isArray(
            row.result
          )
      );
  }

  sortRows(
    base.rows
  );

  /*
   * Nếu key rỗng thì bỏ cursor cũ.
   */
  if (
    base.rows.length === 0
  ) {
    base.cursor =
      null;

    base.backfillLocked =
      false;
  } else {

    if (
      isValidISODate(
        value.cursor
      )
    ) {
      base.cursor =
        value.cursor;
    }

    base.backfillLocked =
      value.backfillLocked ===
      true;
  }

  base.updatedAt =
    value.updatedAt ||
    null;

  return base;
}

function sortRows(rows) {
  rows.sort(
    (a, b) =>
      String(b.date)
        .localeCompare(
          String(a.date)
        )
  );
}

function hasDate(
  rows,
  date
) {
  return rows.some(
    row =>
      row.date === date
  );
}

function insertRow(
  rows,
  row
) {
  if (!row) {
    return false;
  }

  if (
    hasDate(
      rows,
      row.date
    )
  ) {
    return false;
  }

  rows.push(row);

  sortRows(
    rows
  );

  return true;
}


/* =========================================================
   CURSOR
   ========================================================= */

function getCursor(
  store,
  game,
  today
) {
  if (
    isValidISODate(
      store.cursor
    )
  ) {
    return store.cursor;
  }

  return addDays(
    today,
    -1
  );
}

function moveCursorBack(
  store,
  game,
  date
) {
  const cutoff =
    GAMES[game]
      .cutoff;

  if (
    date === cutoff
  ) {
    store.cursor =
      cutoff;

    store.backfillLocked =
      true;

    return;
  }

  const next =
    addDays(
      date,
      -1
    );

  if (
    next < cutoff
  ) {
    store.cursor =
      cutoff;

    store.backfillLocked =
      true;

    return;
  }

  store.cursor =
    next;
}


/* =========================================================
   LIVE
   ========================================================= */

async function updateLive(
  store,
  budget
) {
  let requests = 0;

  const today =
    todayVN();

  const result = {
    date: today,
    checked: false,
    scheduled: false,
    found: false,
    added: false,
    reason: null
  };

  const game =
    store.game;

  if (
    requests >= budget
  ) {
    result.reason =
      "BUDGET";

    return {
      requests,
      result
    };
  }

  const scheduled =
    isDrawDay(
      game,
      today
    );

  result.scheduled =
    scheduled;

  if (!scheduled) {
    result.reason =
      "NOT_DRAW_DAY";

    return {
      requests,
      result
    };
  }

  result.checked =
    true;

  const response =
    await fetchOne(
      game,
      today
    );

  requests++;

  if (
    !response.found
  ) {
    result.reason =
      "NO_RESULT";

    return {
      requests,
      result
    };
  }

  result.found =
    true;

  result.reason =
    "OK";

  result.added =
    insertRow(
      store.rows,
      response.item
    );

  return {
    requests,
    result
  };
}


/* =========================================================
   BACKFILL
   ========================================================= */

async function updateBackfill(
  store,
  budget,
  today
) {
  let requests = 0;
  let added = 0;
  let checked = 0;

  const skipped = [];

  const game =
    store.game;

  while (
    requests < budget &&
    !store.backfillLocked
  ) {

    let cursor =
      getCursor(
        store,
        game,
        today
      );

    const cutoff =
      GAMES[game]
        .cutoff;

    if (
      cursor < cutoff
    ) {
      cursor =
        cutoff;

      store.cursor =
        cutoff;
    }

    /*
     * Không phải ngày quay:
     * không fetch.
     */
    if (
      !isDrawDay(
        game,
        cursor
      )
    ) {

      if (
        cursor === cutoff
      ) {
        store.cursor =
          cutoff;

        store.backfillLocked =
          true;

        continue;
      }

      store.cursor =
        addDays(
          cursor,
          -1
        );

      continue;
    }

    /*
     * Đúng ngày quay thì fetch.
     */
    const response =
      await fetchOne(
        game,
        cursor
      );

    requests++;
    checked++;

    if (
      response.found
    ) {

      if (
        insertRow(
          store.rows,
          response.item
        )
      ) {
        added++;
      }

    } else {
      /*
       * Không lưu no_result.
       * Chỉ báo trong kết quả /run.
       */
      skipped.push(
        cursor
      );
    }

    moveCursorBack(
      store,
      game,
      cursor
    );
  }

  return {
    requests,
    checked,
    added,
    skipped
  };
}


/* =========================================================
   RUN GAME
   ========================================================= */

async function runGame(
  env,
  game,
  budget
) {
  const key =
    kvKey(game);

  const stored =
    await env.VIETLOTT.get(
      key,
      "json"
    );

  const store =
    normalizeGameStore(
      stored,
      game
    );

  const today =
    todayVN();

  /*
   * Live.
   */
  const live =
    await updateLive(
      store,
      budget
    );

  /*
   * Backfill.
   */
  const remaining =
    Math.max(
      0,
      budget -
      live.requests
    );

  let backfill = {
    requests: 0,
    checked: 0,
    added: 0,
    skipped: []
  };

  if (
    remaining > 0 &&
    !store.backfillLocked
  ) {
    backfill =
      await updateBackfill(
        store,
        remaining,
        today
      );
  }

  store.updatedAt =
    new Date()
      .toISOString();

  /*
   * Mỗi game chỉ PUT một lần.
   */
  await env.VIETLOTT.put(
    key,
    JSON.stringify(store)
  );

  return {
    game,
    kvKey: key,

    sourceRequests:
      live.requests +
      backfill.requests,

    live,
    backfill,

    total:
      store.rows.length,

    newest:
      store.rows[0]?.date ||
      null,

    oldest:
      store.rows.at(-1)?.date ||
      null,

    cursor:
      store.cursor,

    cutoff:
      GAMES[game].cutoff,

    backfillLocked:
      store.backfillLocked,

    updatedAt:
      store.updatedAt
  };
}


/* =========================================================
   RUN ALL
   ========================================================= */

async function runWorker(env) {
  const startedAt =
    new Date()
      .toISOString();

  /*
   * Tổng 50 source requests.
   *
   * Mega 25
   * Power 25
   */
  const mega =
    await runGame(
      env,
      "mega645",
      25
    );

  const power =
    await runGame(
      env,
      "power655",
      25
    );

  const finishedAt =
    new Date()
      .toISOString();

  return {
    ok: true,

    startedAt,
    finishedAt,

    today:
      todayVN(),

    targetPerRun:
      MAX_SOURCE_REQUESTS,

    sourceRequests:
      mega.sourceRequests +
      power.sourceRequests,

    mega645:
      mega,

    power655:
      power
  };
}


/* =========================================================
   LATEST
   ========================================================= */

async function getLatest(env) {
  const mega =
    normalizeGameStore(
      await env.VIETLOTT.get(
        MEGA_KEY,
        "json"
      ),
      "mega645"
    );

  const power =
    normalizeGameStore(
      await env.VIETLOTT.get(
        POWER_KEY,
        "json"
      ),
      "power655"
    );

  return {
    ok: true,

    kvKeys: {
      mega645:
        MEGA_KEY,

      power655:
        POWER_KEY
    },

    mega645: {
      game:
        "MEGA 6/45",

      rows:
        mega.rows
    },

    power655: {
      game:
        "POWER 6/55",

      rows:
        power.rows
    },

    updatedAt: {
      mega645:
        mega.updatedAt,

      power655:
        power.updatedAt
    }
  };
}


/* =========================================================
   STATUS
   ========================================================= */

async function getStatus(env) {
  const mega =
    normalizeGameStore(
      await env.VIETLOTT.get(
        MEGA_KEY,
        "json"
      ),
      "mega645"
    );

  const power =
    normalizeGameStore(
      await env.VIETLOTT.get(
        POWER_KEY,
        "json"
      ),
      "power655"
    );

  return {
    ok: true,

    version: 4,

    kvBinding:
      "VIETLOTT",

    kvKeys: {
      mega645:
        MEGA_KEY,

      power655:
        POWER_KEY
    },

    source:
      SOURCE,

    cron:
      "*/1 * * * *",

    schedules: {
      mega645:
        ["CN", "T4", "T6"],

      power655:
        ["T3", "T5", "T7"]
    },

    cutoffs: {
      mega645:
        GAMES.mega645.cutoff,

      power655:
        GAMES.power655.cutoff
    },

    mega645: {
      total:
        mega.rows.length,

      newest:
        mega.rows[0]?.date ||
        null,

      oldest:
        mega.rows.at(-1)?.date ||
        null,

      cursor:
        mega.cursor,

      backfillLocked:
        mega.backfillLocked,

      updatedAt:
        mega.updatedAt
    },

    power655: {
      total:
        power.rows.length,

      newest:
        power.rows[0]?.date ||
        null,

      oldest:
        power.rows.at(-1)?.date ||
        null,

      cursor:
        power.cursor,

      backfillLocked:
        power.backfillLocked,

      updatedAt:
        power.updatedAt
    },

    allBackfillLocked:
      mega.backfillLocked &&
      power.backfillLocked
  };
}


/* =========================================================
   HTTP
   ========================================================= */

export default {

  async fetch(
    request,
    env,
    ctx
  ) {

    if (
      request.method ===
      "OPTIONS"
    ) {
      return new Response(
        null,
        {
          status: 204,
          headers:
            corsHeaders()
        }
      );
    }

    const url =
      new URL(
        request.url
      );


    /* =====================
       /
       ===================== */

    if (
      url.pathname === "/"
    ) {
      return json({
        ok: true,

        worker:
          "VIETLOTT AUTO",

        version: 4,

        kvBinding:
          "VIETLOTT",

        kvKeys: {
          mega645:
            MEGA_KEY,

          power655:
            POWER_KEY
        },

        source:
          SOURCE,

        cron:
          "*/1 * * * *",

        games: {
          mega645: {
            name:
              "MEGA 6/45",

            drawDays:
              ["CN", "T4", "T6"],

            cutoff:
              "2018-01-03"
          },

          power655: {
            name:
              "POWER 6/55",

            drawDays:
              ["T3", "T5", "T7"],

            cutoff:
              "2018-02-01"
          }
        },

        endpoints: [
          "/",
          "/latest",
          "/status",
          "/run"
        ]
      });
    }


    /* =====================
       /latest
       ===================== */

    if (
      url.pathname ===
      "/latest"
    ) {
      try {
        return json(
          await getLatest(
            env
          )
        );
      } catch (error) {
        return json(
          {
            ok: false,

            error:
              String(
                error?.message ||
                error
              )
          },
          500
        );
      }
    }


    /* =====================
       /status
       ===================== */

    if (
      url.pathname ===
      "/status"
    ) {
      try {
        return json(
          await getStatus(
            env
          )
        );
      } catch (error) {
        return json(
          {
            ok: false,

            error:
              String(
                error?.message ||
                error
              )
          },
          500
        );
      }
    }


    /* =====================
       /run
       ===================== */

    if (
      url.pathname ===
      "/run"
    ) {
      try {
        return json(
          await runWorker(
            env
          )
        );
      } catch (error) {
        return json(
          {
            ok: false,

            error:
              String(
                error?.message ||
                error
              )
          },
          500
        );
      }
    }


    /* =====================
       404
       ===================== */

    return json(
      {
        ok: false,
        error:
          "NOT_FOUND"
      },
      404
    );
  },


  /* =======================================================
     CRON
     ======================================================= */

  async scheduled(
    event,
    env,
    ctx
  ) {
    ctx.waitUntil(
      runWorker(env)
    );
  }

};