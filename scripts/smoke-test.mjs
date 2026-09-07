import "dotenv/config";

const baseUrl = process.env.API_BASE_URL ?? "http://localhost:5000/api/v1";
const state = { adminToken: "", customerToken: "", managerToken: "", courierToken: "" };

const request = async (label, path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok)
    throw new Error(`${label} failed (${response.status}): ${JSON.stringify(payload)}`);
  console.log(`OK ${label} (${response.status})`);
  return payload;
};

const expectStatus = async (label, path, expectedStatus, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (response.status !== expectedStatus) {
    throw new Error(
      `${label} expected ${expectedStatus}, received ${response.status}: ${await response.text()}`,
    );
  }
  console.log(`OK ${label} (${response.status})`);
};

const login = async (email, password) =>
  request(`Login ${email}`, "/auth/login", { method: "POST", body: { email, password } });

const main = async () => {
  await request("Health check", "/health");

  const [admin, customer, manager, courier] = await Promise.all([
    login("admin@shipperex.com", "Admin@12345"),
    login("customer@shipperex.com", "Customer@12345"),
    login("manager@shipperex.com", "Manager@12345"),
    login("rahim.courier@shipperex.com", "Courier@12345"),
  ]);
  state.adminToken = admin.data.accessToken;
  state.customerToken = customer.data.accessToken;
  state.managerToken = manager.data.accessToken;
  state.courierToken = courier.data.accessToken;

  if (manager.data.user.staffProfile.staffType !== "MANAGER")
    throw new Error("Manager subtype missing");
  if (courier.data.user.staffProfile.staffType !== "COURIER")
    throw new Error("Courier subtype missing");

  await request("Customer profile", "/users/me", { token: state.customerToken });
  await request("Courier profile", "/users/me", { token: state.courierToken });
  await expectStatus("Customer blocked from Admin users", "/admin/users", 403, {
    token: state.customerToken,
  });
  await expectStatus("Courier blocked from Manager courier list", "/couriers", 403, {
    token: state.courierToken,
  });
  await expectStatus("Protected endpoint requires token", "/users/me", 401);
  await expectStatus("Register validation", "/auth/register", 400, {
    method: "POST",
    body: { name: "A", email: "bad", password: "weak" },
  });

  const countries = (await request("List countries", "/countries")).data;
  const hubs = (await request("List hubs", "/hubs", { token: state.customerToken })).data;
  const bangladesh = countries.find((item) => item.iso2Code === "BD");
  const peru = countries.find((item) => item.iso2Code === "PE");
  const chattogram = hubs.find((item) => item.code === "CTG-HUB");
  const lima = hubs.find((item) => item.code === "LIM-HUB");
  if (!bangladesh || !peru || !chattogram || !lima)
    throw new Error("Required seed data is missing");

  const shipment = {
    direction: "EXPORT",
    shipmentType: "PARCEL",
    originCountryId: bangladesh.id,
    destinationCountryId: peru.id,
    originHubId: chattogram.id,
    destinationHubId: lima.id,
    weightKg: 2,
    pickupScheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
    sender: {
      name: "Smoke Sender",
      phone: "+8801700000098",
      address: "Agrabad, Chattogram",
      city: "Chattogram",
      countryId: bangladesh.id,
    },
    recipient: {
      name: "Smoke Receiver",
      phone: "+51955501998",
      address: "Central Lima Address",
      city: "Lima",
      countryId: peru.id,
    },
  };

  await expectStatus("Reject mismatched sender country", "/shipments", 400, {
    method: "POST",
    token: state.customerToken,
    body: {
      ...shipment,
      sender: { ...shipment.sender, countryId: peru.id },
    },
  });
  await expectStatus("Reject hub outside origin country", "/shipments", 400, {
    method: "POST",
    token: state.customerToken,
    body: { ...shipment, originHubId: lima.id },
  });
  await expectStatus("Reject mismatched recipient country", "/shipments", 400, {
    method: "POST",
    token: state.customerToken,
    body: {
      ...shipment,
      recipient: { ...shipment.recipient, countryId: bangladesh.id },
    },
  });
  await expectStatus("Reject hub outside destination country", "/shipments", 400, {
    method: "POST",
    token: state.customerToken,
    body: { ...shipment, destinationHubId: chattogram.id },
  });

  await request("Quote export shipment", "/shipments/quote", {
    method: "POST",
    token: state.customerToken,
    body: shipment,
  });
  await request("Quote import shipment", "/shipments/quote", {
    method: "POST",
    token: state.customerToken,
    body: {
      ...shipment,
      direction: "IMPORT",
      originCountryId: peru.id,
      destinationCountryId: bangladesh.id,
    },
  });

  const created = await request("Create shipment", "/shipments", {
    method: "POST",
    token: state.customerToken,
    body: shipment,
  });
  if (
    created.data.senderSnapshot.countryCode !== "BD" ||
    created.data.recipientSnapshot.countryCode !== "PE"
  ) {
    throw new Error("Canonical address country details were not saved");
  }
  await request("My shipments", "/shipments/my", { token: state.customerToken });
  await request("Manager hub shipments", "/shipments", { token: state.managerToken });
  await request("Manager hub couriers", "/couriers", { token: state.managerToken });
  await request("Public tracking", `/tracking/${created.data.trackingNumber}`);
  await request("Shipment timeline", `/shipments/${created.data.id}/timeline`, {
    token: state.customerToken,
  });
  await request("My payments", "/payments/my", { token: state.customerToken });
  await request("My notifications", "/notifications", { token: state.customerToken });
  await request("Admin users", "/admin/users", { token: state.adminToken });
  await request("Admin dashboard", "/admin/dashboard-stats", { token: state.adminToken });
  await request("Admin audit logs", "/admin/audit-logs", { token: state.adminToken });

  if (process.env.RUN_STRIPE_SMOKE === "true") {
    const checkout = await request(
      "Initiate real Stripe Checkout",
      `/payments/${created.data.id}/initiate`,
      {
        method: "POST",
        token: state.customerToken,
      },
    );
    console.log(`Complete this real test payment in Stripe Checkout: ${checkout.data.checkoutUrl}`);
  }

  console.log("\nSmoke test completed without fake payment updates.");
  console.log(`Shipment ID: ${created.data.id}`);
  console.log(`Tracking number: ${created.data.trackingNumber}`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
