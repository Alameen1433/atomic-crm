import { useEffect, useState } from "react";
import { Form, required, useNotify, useTranslate } from "ra-core";
import { useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/admin/text-input";
import { Layout } from "@/components/supabase/layout";
import { clearAuthCache } from "@/components/atomic-crm/providers/supabase/authProvider";
import { getSupabaseClient } from "@/components/atomic-crm/providers/supabase/supabase";
import {
  clearPasswordFlowMarker,
  parsePasswordFlowMarker,
  PASSWORD_FLOW_STORAGE_KEY,
  type PasswordFlowMarker,
} from "@/lib/passwordFlow";

interface SetPasswordFormData {
  password: string;
  confirmPassword: string;
}

type PageState =
  | { status: "loading" }
  | { status: "invalid" }
  | { status: "ready"; marker: PasswordFlowMarker };

export const SetPasswordPage = () => {
  const [loading, setLoading] = useState(false);
  const [pageState, setPageState] = useState<PageState>({ status: "loading" });
  const location = useLocation();
  const notify = useNotify();
  const translate = useTranslate();

  useEffect(() => {
    let cancelled = false;

    const loadPasswordFlow = async () => {
      const { data, error } = await getSupabaseClient().auth.getSession();
      const marker = parsePasswordFlowMarker(
        window.sessionStorage.getItem(PASSWORD_FLOW_STORAGE_KEY),
        data.session?.user.id ?? null,
      );
      const requestedFlow = new URLSearchParams(location.search).get("flow");

      if (cancelled) return;
      if (error || !marker || requestedFlow !== marker.type) {
        clearPasswordFlowMarker(window.sessionStorage);
        setPageState({ status: "invalid" });
        return;
      }

      setPageState({ status: "ready", marker });
    };

    void loadPasswordFlow();
    return () => {
      cancelled = true;
    };
  }, [location.search]);

  const validate = (values: SetPasswordFormData) => {
    if (values.password !== values.confirmPassword) {
      return {
        password: "ra-supabase.validation.password_mismatch",
        confirmPassword: "ra-supabase.validation.password_mismatch",
      };
    }
    return {};
  };

  const submit = async (values: SetPasswordFormData) => {
    try {
      setLoading(true);
      const { error } = await getSupabaseClient().auth.updateUser({
        password: values.password,
      });
      if (error) throw error;

      clearPasswordFlowMarker(window.sessionStorage);
      clearAuthCache();
      try {
        const { error: signOutError } = await getSupabaseClient().auth.signOut({
          scope: "global",
        });
        if (signOutError) {
          await getSupabaseClient().auth.signOut({ scope: "local" });
        }
      } catch {
        try {
          await getSupabaseClient().auth.signOut({ scope: "local" });
        } catch {
          // The password is already updated. Continue to the clean sign-in
          // screen even if Supabase could not revoke the temporary session.
        }
      }
      window.location.replace("./#/login?passwordUpdated=1");
    } catch (error: any) {
      notify(
        typeof error === "string"
          ? error
          : typeof error === "undefined" || !error.message
            ? "ra.auth.sign_in_error"
            : error.message,
        {
          type: "warning",
          messageArgs: {
            _:
              typeof error === "string"
                ? error
                : error && error.message
                  ? error.message
                  : undefined,
          },
        },
      );
    } finally {
      setLoading(false);
    }
  };

  if (pageState.status === "loading") {
    return (
      <Layout>
        <p>Verifying your secure password session…</p>
      </Layout>
    );
  }

  if (pageState.status === "invalid") {
    return (
      <Layout>
        <div className="space-y-4 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Password link unavailable
          </h1>
          <p>
            This password session is missing or has expired. Request a fresh
            email and open its link again.
          </p>
          <Button asChild>
            <a href="./#/forgot-password">Request a new reset link</a>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {pageState.marker.type === "invite"
            ? "Create your password"
            : translate("ra-supabase.set_password.new_password", {
                _: "Choose your new password",
              })}
        </h1>
        <p className="text-sm text-muted-foreground">
          After saving, sign in once with your new password.
        </p>
      </div>
      <Form
        className="space-y-8"
        onSubmit={submit as any}
        validate={validate as any}
      >
        <TextInput
          label={translate("ra.auth.password", {
            _: "Password",
          })}
          autoComplete="new-password"
          source="password"
          type="password"
          validate={required()}
        />
        <TextInput
          label={translate("crm.auth.confirm_password", {
            _: "Confirm password",
          })}
          autoComplete="new-password"
          source="confirmPassword"
          type="password"
          validate={required()}
        />
        <Button type="submit" className="cursor-pointer" disabled={loading}>
          {loading ? "Saving…" : translate("ra.action.save")}
        </Button>
      </Form>
    </Layout>
  );
};

SetPasswordPage.path = "set-password";
