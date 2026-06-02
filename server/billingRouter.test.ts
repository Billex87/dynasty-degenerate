import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { appRouter } from "./routers";
import { findBillingCustomerForUser } from "./db";
import {
  createStripeCheckoutSession,
  createStripeCustomerPortalSession,
} from "./stripeBilling";

vi.mock("./db", async () => {
  const actual = await vi.importActual<typeof import("./db")>("./db");
  return {
    ...actual,
    findBillingCustomerForUser: vi.fn(),
  };
});

vi.mock("./stripeBilling", async () => {
  const actual = await vi.importActual<typeof import("./stripeBilling")>("./stripeBilling");
  return {
    ...actual,
    createStripeCheckoutSession: vi.fn(),
    createStripeCustomerPortalSession: vi.fn(),
  };
});

const mockedFindBillingCustomerForUser = vi.mocked(findBillingCustomerForUser);
const mockedCreateStripeCheckoutSession = vi.mocked(createStripeCheckoutSession);
const mockedCreateStripeCustomerPortalSession = vi.mocked(createStripeCustomerPortalSession);

const user: User = {
  id: 42,
  openId: "email:user",
  name: "Sample User",
  email: "user@example.com",
  loginMethod: "magic-link",
  role: "user",
  createdAt: new Date("2026-06-02T12:00:00.000Z"),
  updatedAt: new Date("2026-06-02T12:00:00.000Z"),
  lastSignedIn: new Date("2026-06-02T12:00:00.000Z"),
};

function createContext(currentUser: User | null = user): TrpcContext {
  return {
    user: currentUser,
    req: {
      protocol: "http",
      ip: "192.0.2.44",
      headers: {
        host: "localhost:3000",
        "x-forwarded-proto": "https",
        "x-forwarded-host": "dynastydegens.com",
      },
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("billing router", () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
    delete process.env.DATABASE_URL;
    vi.clearAllMocks();
    mockedCreateStripeCheckoutSession.mockResolvedValue({
      id: "cs_test",
      url: "https://checkout.stripe.com/test",
      mode: "subscription",
      productKey: "pro-monthly",
    });
    mockedCreateStripeCustomerPortalSession.mockResolvedValue({
      id: "bps_test",
      url: "https://billing.stripe.com/session",
    });
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it("requires an authenticated user for checkout", async () => {
    const caller = appRouter.createCaller(createContext(null));

    await expect(caller.billing.createCheckoutSession({
      productKey: "pro-monthly",
    })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("creates checkout sessions with linked Stripe customers and first-party return paths", async () => {
    mockedFindBillingCustomerForUser.mockResolvedValue({
      stripeCustomerId: "cus_existing",
      email: "user@example.com",
      status: "active",
      updatedAt: new Date("2026-06-02T12:00:00.000Z"),
    });
    const caller = appRouter.createCaller(createContext());

    const result = await caller.billing.createCheckoutSession({
      productKey: "pro-monthly",
      returnPath: "https://evil.example/steal",
    });

    expect(result).toEqual({
      id: "cs_test",
      url: "https://checkout.stripe.com/test",
      mode: "subscription",
      productKey: "pro-monthly",
    });
    expect(mockedFindBillingCustomerForUser).toHaveBeenCalledWith("email:user");
    expect(mockedCreateStripeCheckoutSession).toHaveBeenCalledWith({
      productKey: "pro-monthly",
      userOpenId: "email:user",
      userEmail: "user@example.com",
      stripeCustomerId: "cus_existing",
      leagueId: undefined,
      appBaseUrl: "https://dynastydegens.com",
      returnPath: "/",
    });
  });

  it("passes league IDs through for league-pass checkout", async () => {
    mockedFindBillingCustomerForUser.mockResolvedValue(null);
    const caller = appRouter.createCaller(createContext());

    await caller.billing.createCheckoutSession({
      productKey: "league-pass-season",
      leagueId: "123456789012345678",
      returnPath: "/report?leagueId=123456789012345678",
    });

    expect(mockedCreateStripeCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
      productKey: "league-pass-season",
      leagueId: "123456789012345678",
      stripeCustomerId: undefined,
      returnPath: "/report?leagueId=123456789012345678",
    }));
  });

  it("requires an existing billing customer before creating a portal session", async () => {
    mockedFindBillingCustomerForUser.mockResolvedValue(null);
    const caller = appRouter.createCaller(createContext());

    await expect(caller.billing.createCustomerPortalSession({
      returnPath: "/account",
    })).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
      message: "No Stripe customer is linked to this user yet.",
    });
    expect(mockedCreateStripeCustomerPortalSession).not.toHaveBeenCalled();
  });

  it("creates portal sessions for linked customers", async () => {
    mockedFindBillingCustomerForUser.mockResolvedValue({
      stripeCustomerId: "cus_existing",
      email: "user@example.com",
      status: "active",
      updatedAt: new Date("2026-06-02T12:00:00.000Z"),
    });
    const caller = appRouter.createCaller(createContext());

    const result = await caller.billing.createCustomerPortalSession({
      returnPath: "/account?tab=billing",
    });

    expect(result).toEqual({
      id: "bps_test",
      url: "https://billing.stripe.com/session",
    });
    expect(mockedCreateStripeCustomerPortalSession).toHaveBeenCalledWith({
      stripeCustomerId: "cus_existing",
      appBaseUrl: "https://dynastydegens.com",
      returnPath: "/account?tab=billing",
    });
  });
});
