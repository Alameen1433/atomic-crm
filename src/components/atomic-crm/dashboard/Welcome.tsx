import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Welcome = () => (
  <Card>
    <CardHeader className="px-4">
      <CardTitle>Welcome to Xenora CRM</CardTitle>
    </CardHeader>
    <CardContent className="px-4">
      <p className="text-sm mb-4">
        Manage your contacts, companies, deals, and commissions from one
        workspace.
      </p>
      <p className="text-sm mb-4">
        This demo uses temporary sample data and resets when the page reloads.
      </p>
    </CardContent>
  </Card>
);
