export const canResetPassword = (
  currentSale: { id: string | number; administrator: boolean },
  targetSalesId: string | number,
) =>
  currentSale.administrator || String(currentSale.id) === String(targetSalesId);
