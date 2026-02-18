export type Rate = {
  id: string;
  article: string;
  norm: number;
};

export type PlanItem = {
  id: string;
  article: string;
  target: number;
  completed: number;
  locked: boolean;
};

export type WCEntry = {
  id: string;
  article: string;
  quantity: number;
  date: string;
  updatedAt: number;
};

export type Welder = {
  id: string;
  lastName: string;
  entries: WCEntry[];
  overtime: Record<string, number>;
  overtimeManual: Record<string, boolean>;
};
