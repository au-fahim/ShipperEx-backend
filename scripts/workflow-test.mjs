import "dotenv/config";

const baseUrl = process.env.API_BASE_URL ?? "http://localhost:5000/api/v1";
const shipmentId = process.env.PAID_SHIPMENT_ID;

if (!shipmentId) {
  throw new Error("PAID_SHIPMENT_ID is required and must reference a real Stripe-paid shipment");
}

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

const login = async (email, password) =>
  (await request(`Login ${email}`, "/auth/login", { method: "POST", body: { email, password } }))
    .data;

const latestTask = async (token, taskType) =>
  (
    await request(`Read latest ${taskType} task`, `/courier/tasks?taskType=${taskType}&limit=1`, {
      token,
    })
  ).data[0];

const main = async () => {
  const [customer, originManager, originCourier, destinationManager, destinationCourier] =
    await Promise.all([
      login("customer@shipperex.com", "Customer@12345"),
      login("manager@shipperex.com", "Manager@12345"),
      login("rahim.courier@shipperex.com", "Courier@12345"),
      login("manager.lima@shipperex.com", "Manager@12345"),
      login("carlos.courier@shipperex.com", "Courier@12345"),
    ]);

  await request("Assign pickup courier", `/shipments/${shipmentId}/assignments`, {
    method: "POST",
    token: originManager.accessToken,
    body: {
      courierId: originCourier.user.staffProfile.id,
      taskType: "PICKUP",
      note: "Pickup assigned at the origin hub",
    },
  });
  const pickupTask = await latestTask(originCourier.accessToken, "PICKUP");
  await request("Start pickup", `/courier/tasks/${pickupTask.id}/start`, {
    method: "PATCH",
    token: originCourier.accessToken,
    body: { note: "Courier is travelling to the sender" },
  });
  await request("Complete pickup", `/courier/tasks/${pickupTask.id}/complete`, {
    method: "PATCH",
    token: originCourier.accessToken,
    body: { location: "Chattogram", note: "Parcel collected from sender" },
  });
  await request("Receive at origin hub", `/shipments/${shipmentId}/status`, {
    method: "PATCH",
    token: originManager.accessToken,
    body: { status: "AT_ORIGIN_HUB", location: "Chattogram Hub" },
  });
  await request("Dispatch in transit", `/shipments/${shipmentId}/status`, {
    method: "PATCH",
    token: originManager.accessToken,
    body: {
      status: "IN_TRANSIT",
      currentHubId: destinationManager.user.staffProfile.hubId,
      location: "Departed origin country",
    },
  });
  await request("Receive at destination hub", `/shipments/${shipmentId}/status`, {
    method: "PATCH",
    token: destinationManager.accessToken,
    body: { status: "AT_DESTINATION_HUB", location: "Lima Hub" },
  });
  await request("Assign delivery courier", `/shipments/${shipmentId}/assignments`, {
    method: "POST",
    token: destinationManager.accessToken,
    body: {
      courierId: destinationCourier.user.staffProfile.id,
      taskType: "DELIVERY",
      note: "Final-mile delivery assigned",
    },
  });
  const deliveryTask = await latestTask(destinationCourier.accessToken, "DELIVERY");
  await request("Start delivery", `/courier/tasks/${deliveryTask.id}/start`, {
    method: "PATCH",
    token: destinationCourier.accessToken,
    body: { note: "Courier is out for delivery" },
  });
  await request("Complete delivery", `/courier/tasks/${deliveryTask.id}/complete`, {
    method: "PATCH",
    token: destinationCourier.accessToken,
    body: { location: "Lima", note: "Delivered to recipient" },
  });

  const shipment = await request("Verify delivered shipment", `/shipments/${shipmentId}`, {
    token: customer.accessToken,
  });
  if (shipment.data.status !== "DELIVERED") throw new Error("Shipment was not delivered");
  console.log("\nReal-payment shipment workflow completed successfully.");
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
