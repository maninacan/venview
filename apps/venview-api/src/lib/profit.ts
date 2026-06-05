// Shared profit calculation logic — ported from old buildPostEventReport()

export interface SalesSummaryRow {
  grossSales?: number | null;
  netSales?: number | null;
  discounts?: number | null;
  refunds?: number | null;
  tax?: number | null;
  tips?: number | null;
  squareFees?: number | null;
  posFees?: number | null;
  taxRate?: number | null;
  taxOverride?: boolean | null;
  totalCollected?: number | null;
}

export interface ExpensesRow {
  healthDeptFee?: number | null;
  eventFee?: number | null;
  mileage?: number | null;
  mileageRate?: number | null;
  coordinatorFee?: number | null;
  posFee?: number | null;
  employeeBonus?: number | null;
  eventRunnerFees?: number | null;
}

export interface LaborRow {
  hours?: number | null;
  wage?: number | null;
  total?: number | null;
}

export interface AdditionalFeeRow {
  amount: number;
  isDiscount: boolean;
}

export interface ProfitSummary {
  posFees: number;
  cogs: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  tips: number;
  stateFoodTax: number;
  laborFees: number;
  additionalFeesTotal: number;
  mileageReimbursement: number;
}

export function computeProfit(
  sales: SalesSummaryRow | null,
  expenses: ExpensesRow | null,
  laborRows: LaborRow[],
  additionalFees: AdditionalFeeRow[],
  cogsSalesFees: number,
  hasSquare: boolean,
  taxRate = 0
): ProfitSummary {
  const n = (v: number | null | undefined) => Number(v ?? 0);

  const netSales = n(sales?.netSales);
  const squareTips = n(sales?.tips);
  const tips = squareTips;

  // Labor: sum from actual shift rows (ceiling per shift, matching client Labor Card)
  const laborFees = laborRows.reduce((sum, r) => {
    const shiftTotal = n(r.total) || (n(r.hours) * n(r.wage));
    return sum + Math.ceil(shiftTotal * 100) / 100;
  }, 0);

  // Additional fees/discounts
  const additionalFeesTotal = additionalFees.reduce((sum, f) => {
    return f.isDiscount ? sum - n(f.amount) : sum + n(f.amount);
  }, 0);

  const mileageReimbursement = n(expenses?.mileage) * n(expenses?.mileageRate ?? 0.67);

  // POS fees: manual override wins, then Square fees for Square-linked events
  const manualPosFee = n(expenses?.posFee);
  const posFees = manualPosFee > 0
    ? manualPosFee
    : (hasSquare ? n(sales?.squareFees) : 0);

  const totalExpenses =
    n(expenses?.healthDeptFee) +
    n(expenses?.eventFee) +
    additionalFeesTotal +
    mileageReimbursement +
    n(expenses?.employeeBonus) +
    n(expenses?.eventRunnerFees) +
    laborFees +
    n(expenses?.coordinatorFee) +
    posFees;

  const cogs = cogsSalesFees;
  const grossProfit = netSales - cogs;
  const netProfit = grossProfit - totalExpenses;

  // Sales tax: informational only, never deducted from profit
  const taxBase = n(sales?.totalCollected) || netSales;
  const stateFoodTax = taxBase * taxRate;

  return {
    posFees,
    cogs,
    grossProfit,
    totalExpenses,
    netProfit,
    tips,
    stateFoodTax,
    laborFees,
    additionalFeesTotal,
    mileageReimbursement,
  };
}
