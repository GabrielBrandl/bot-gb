import { resolveCampaignContactIds } from "./campaign-segmentation";

describe("resolveCampaignContactIds", () => {
  const contacts = [
    {
      id: "c1",
      phone: "5511999999999",
      tags: [{ id: "t1" }],
      kanbanCards: [{ stageId: "s1" }],
    },
    {
      id: "c2",
      phone: "5511888888888",
      tags: [{ id: "t2" }],
      kanbanCards: [{ stageId: "s2" }],
    },
    {
      id: "c3",
      phone: "5511777777777",
      tags: [{ id: "t1" }, { id: "t2" }],
      kanbanCards: [{ stageId: "s1" }],
    },
  ];

  it("returns all contacts when no filters", () => {
    expect(resolveCampaignContactIds(contacts)).toEqual(["c1", "c2", "c3"]);
  });

  it("filters by tagIds", () => {
    expect(resolveCampaignContactIds(contacts, ["t1"])).toEqual(["c1", "c3"]);
  });

  it("filters by stageId", () => {
    expect(resolveCampaignContactIds(contacts, undefined, "s2")).toEqual(["c2"]);
  });

  it("filters by tagIds and stageId", () => {
    expect(resolveCampaignContactIds(contacts, ["t1"], "s1")).toEqual(["c1", "c3"]);
  });
});
