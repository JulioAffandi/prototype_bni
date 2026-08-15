import { redirect } from "next/navigation";

export default function RegisterSchoolRedirect() {
  redirect("/register?role=school_admin");
}
