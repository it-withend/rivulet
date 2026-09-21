import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { enqueueReport, flushQueue, queuedCount } from "../report-queue";

const payload = {
  waterbodyId: "wb-1",
  observedAt: "2026-09-20T10:00:00.000Z",
  survey: { forelUle: 8, indicatorTaxa: [] as string[], visibleAlgae: false },
};

const okResponse = () =>
  new Response(JSON.stringify({ id: "obs-1", waterbodyName: "Stream", delta: { wasDataGap: true } }), { status: 201 });

describe("report queue", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("keeps a report with its original time and sends it when the network is back", async () => {
    enqueueReport(payload);
    expect(queuedCount()).toBe(1);

    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    expect(await flushQueue()).toEqual({ sent: 1, remaining: 0 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).observedAt).toBe(payload.observedAt);
    expect(queuedCount()).toBe(0);
  });

  it("keeps everything when the network is still down", async () => {
    enqueueReport(payload);
    enqueueReport(payload);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));

    expect(await flushQueue()).toEqual({ sent: 0, remaining: 2 });
    expect(queuedCount()).toBe(2);
  });

  it("drops a report the server rejects as invalid, but keeps one that hit a server error", async () => {
    enqueueReport(payload);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 400 })));
    expect(await flushQueue()).toEqual({ sent: 0, remaining: 0 });

    enqueueReport(payload);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    expect(await flushQueue()).toEqual({ sent: 0, remaining: 1 });
  });
});
