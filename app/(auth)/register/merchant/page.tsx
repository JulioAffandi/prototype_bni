import { redirect } from "next/navigation";

export default function RegisterMerchantRedirect() {
  redirect("/register?role=merchant_staff");
}
