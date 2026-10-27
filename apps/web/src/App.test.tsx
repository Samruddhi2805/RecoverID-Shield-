import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import App from "./App";
import React from "react";

// Mock fetch for API calls in tests
global.fetch = vi.fn().mockImplementation((url: string) => {
  if (url.includes("/api/notifications/mock-inbox")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ success: true, count: 0, emails: [] })
    });
  }
  if (url.includes("/api/activity")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ activities: [] })
    });
  }
  if (url.includes("/api/guardians")) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ guardians: [] })
    });
  }
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve({})
  });
});

describe("RecoverID Shield Frontend", () => {
  it("renders brand name and tagline accurately", () => {
    render(<App />);
    expect(screen.getAllByText(/RecoverID/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Lose Your Keys, Not Your Assets/i).length).toBeGreaterThan(0);
  });

  it("navigates to Create Wallet flow when clicking CTA", () => {
    render(<App />);
    const createBtn = screen.getByRole("button", { name: /Create Smart Wallet/i });
    fireEvent.click(createBtn);

    expect(screen.getByText(/Generate Owner Private Key/i)).toBeInTheDocument();
    expect(screen.getByText(/Generate Owner Keypair/i)).toBeInTheDocument();
  });

  it("navigates to Security & Backup settings view", () => {
    render(<App />);
    const securityTab = screen.getByRole("button", { name: /Security & Backup/i });
    fireEvent.click(securityTab);

    expect(screen.getByText(/Security Settings & Verifications/i)).toBeInTheDocument();
    expect(screen.getByText(/Contract Address Registry/i)).toBeInTheDocument();
  });
});
