import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useToast } from "../../context/ToastContext";
import { Button, Card, Field, Input, Select } from "../../components/ui";
import type { OrderType, PaymentType, PriceBreakdown } from "../../types";

const initialForm = {
  pickupAddress: "",
  pickupPincode: "",
  dropAddress: "",
  dropPincode: "",
  lengthCm: "",
  breadthCm: "",
  heightCm: "",
  actualWeightKg: "",
  orderType: "B2C" as OrderType,
  paymentType: "PREPAID" as PaymentType,
};

export default function CreateOrderPage() {
  const { push } = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [price, setPrice] = useState<PriceBreakdown | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setPrice(null); // any change invalidates the previous quote
  }

  function payload() {
    return {
      pickupAddress: form.pickupAddress,
      pickupPincode: form.pickupPincode,
      dropAddress: form.dropAddress,
      dropPincode: form.dropPincode,
      lengthCm: Number(form.lengthCm),
      breadthCm: Number(form.breadthCm),
      heightCm: Number(form.heightCm),
      actualWeightKg: Number(form.actualWeightKg),
      orderType: form.orderType,
      paymentType: form.paymentType,
    };
  }

  async function handleCalculate(e: FormEvent) {
    e.preventDefault();
    setCalculating(true);
    setError(null);
    try {
      const { pickupAddress, dropAddress, ...priceInput } = payload();
      const res = await api.post<PriceBreakdown>("/orders/calculate-price", priceInput);
      setPrice(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not calculate price");
      setPrice(null);
    } finally {
      setCalculating(false);
    }
  }

  async function handleConfirm() {
    setConfirming(true);
    setError(null);
    try {
      const res = await api.post("/orders", payload());
      push(`Order ${res.data.orderNumber} created`, "success");
      navigate(`/customer/orders/${res.data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create order");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold text-slate-900 mb-1">Create a new order</h1>
      <p className="text-sm text-slate-500 mb-6">Enter shipment details to get an instant price quote before confirming.</p>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="p-6 md:col-span-2">
          <form onSubmit={handleCalculate} className="space-y-6">
            <section>
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Pickup & drop</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Pickup address">
                  <Input required value={form.pickupAddress} onChange={(e) => update("pickupAddress", e.target.value)} placeholder="123 MG Road" />
                </Field>
                <Field label="Pickup pincode">
                  <Input required value={form.pickupPincode} onChange={(e) => update("pickupPincode", e.target.value)} placeholder="110085" />
                </Field>
                <Field label="Drop address">
                  <Input required value={form.dropAddress} onChange={(e) => update("dropAddress", e.target.value)} placeholder="45 Park Street" />
                </Field>
                <Field label="Drop pincode">
                  <Input required value={form.dropPincode} onChange={(e) => update("dropPincode", e.target.value)} placeholder="110017" />
                </Field>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Package details</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Field label="Length (cm)">
                  <Input required type="number" min="0.1" step="0.1" value={form.lengthCm} onChange={(e) => update("lengthCm", e.target.value)} />
                </Field>
                <Field label="Breadth (cm)">
                  <Input required type="number" min="0.1" step="0.1" value={form.breadthCm} onChange={(e) => update("breadthCm", e.target.value)} />
                </Field>
                <Field label="Height (cm)">
                  <Input required type="number" min="0.1" step="0.1" value={form.heightCm} onChange={(e) => update("heightCm", e.target.value)} />
                </Field>
                <Field label="Actual weight (kg)">
                  <Input required type="number" min="0.01" step="0.01" value={form.actualWeightKg} onChange={(e) => update("actualWeightKg", e.target.value)} />
                </Field>
              </div>
            </section>

            <section>
              <h2 className="text-sm font-semibold text-slate-900 mb-3">Order type & payment</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Order type">
                  <Select value={form.orderType} onChange={(e) => update("orderType", e.target.value)}>
                    <option value="B2C">B2C — Business to Consumer</option>
                    <option value="B2B">B2B — Business to Business</option>
                  </Select>
                </Field>
                <Field label="Payment type">
                  <Select value={form.paymentType} onChange={(e) => update("paymentType", e.target.value)}>
                    <option value="PREPAID">Prepaid</option>
                    <option value="COD">Cash on Delivery</option>
                  </Select>
                </Field>
              </div>
            </section>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button type="submit" disabled={calculating} className="w-full sm:w-auto">
              {calculating ? "Calculating..." : "Calculate price"}
            </Button>
          </form>
        </Card>

        <Card className="p-6 h-fit sticky top-6">
          <h2 className="text-sm font-semibold text-slate-900 mb-4">Price preview</h2>
          {!price && <p className="text-sm text-slate-400">Fill in the form and click "Calculate price" to see your quote.</p>}
          {price && (
            <div className="space-y-3 text-sm">
              <Row label="Pickup zone" value={price.pickupZoneName} />
              <Row label="Drop zone" value={price.dropZoneName} />
              <Row label="Rate type" value={price.rateType === "INTRA_ZONE" ? "Intra-zone" : "Inter-zone"} />
              <Row label="Actual weight" value={`${price.actualWeightKg} kg`} />
              <Row label="Volumetric weight" value={`${price.volumetricWeightKg} kg`} />
              <Row label="Chargeable weight" value={`${price.chargeableWeightKg} kg`} bold />
              <Row label="Rate / kg" value={`₹${price.ratePerKg}`} />
              <Row label="Base charge" value={`₹${price.baseCharge.toFixed(2)}`} />
              {price.codSurcharge > 0 && <Row label="COD surcharge" value={`₹${price.codSurcharge.toFixed(2)}`} />}
              <div className="border-t border-slate-200 pt-3">
                <Row label="Total charge" value={`₹${price.totalCharge.toFixed(2)}`} bold large />
              </div>
              <Button onClick={handleConfirm} disabled={confirming} className="w-full mt-2">
                {confirming ? "Confirming..." : "Confirm order"}
              </Button>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value, bold, large }: { label: string; value: string; bold?: boolean; large?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500">{label}</span>
      <span className={`${bold ? "font-semibold text-slate-900" : "text-slate-700"} ${large ? "text-lg" : ""}`}>{value}</span>
    </div>
  );
}
