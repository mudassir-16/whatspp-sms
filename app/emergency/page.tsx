"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Navbar } from "@/components/navbar"
import { Footer } from "@/components/footer"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AlertCircle, Loader2 } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { auth, db } from "@/lib/firebase"
import { doc, getDoc } from "firebase/firestore"
import { createEmergencyRequest, searchDonors } from "@/lib/firestore-utils"
import { sendEmail, sendEmergencyNotifications, ADMIN_EMAIL } from "@/lib/email-service"
import { sendBloodRequestWhatsAppNotifications } from "@/lib/whatsapp-notifications"
// NOTE: Do NOT import server-only Twilio client into client components.
// Use the server API endpoints (`/api/send-sms` or `/api/send-sms/broadcast`) instead.

const BLOOD_GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"]
const DISTRICTS = [
  "Adilabad",
  "Bhadradri Kothagudem",
  "Hyderabad",
  "Jagtial",
  "Jangaon",
  "Jayashankar Bhupalpally",
  "Jogulamba Gadwal",
  "Kamareddy",
  "Karimnagar",
  "Khammam",
  "Komaram Bheem Asifabad",
  "Mahabubabad",
  "Mahabubnagar",
  "Mancherial",
  "Medak",
  "Medchal-Malkajgiri",
  "Mulugu",
  "Nagarkurnool",
  "Nalgonda",
  "Narayanpet",
  "Nirmal",
  "Nizamabad",
  "Peddapalli",
  "Rajanna Sircilla",
  "Rangareddy",
  "Sangareddy",
  "Siddipet",
  "Suryapet",
  "Vikarabad",
  "Wanaparthy",
  "Warangal Urban",
  "Warangal Rural",
  "Yadadri Bhuvanagiri"
]

export default function EmergencyPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [formData, setFormData] = useState({
    bloodGroup: "",
    district: "",
    urgency: "high",
    description: "",
    contactName: "",
    contactPhone: "",
  })

  const resetForm = () => {
    setFormData({
      bloodGroup: "",
      district: "",
      urgency: "high",
      description: "",
      contactName: "",
      contactPhone: "",
    })
    setSuccess(false)
    setError("")
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!formData.bloodGroup || !formData.district || !formData.contactName || !formData.contactPhone) {
      setError("All fields are required")
      return
    }

    setLoading(true)

    try {
      // Create emergency request in database
      await createEmergencyRequest({
        bloodGroup: formData.bloodGroup as any,
        district: formData.district,
        urgency: formData.urgency as any,
        description: formData.description,
        contactName: formData.contactName,
        contactPhone: formData.contactPhone,
        status: "open",
      })

      // 0. Get current user info to include in notification if possible
      let userInfoText = "";
      const currentUser = auth.currentUser;
      let userEmail = "";

      if (currentUser) {
        userEmail = currentUser.email || "";
        try {
          const donorRef = doc(db, "donors", currentUser.uid);
          const donorSnap = await getDoc(donorRef);
          if (donorSnap.exists()) {
            const donorData = donorSnap.data();
            userInfoText = `
              <div style="background: #e8f4fd; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <h2 style="color: #007bff; margin-top: 0;">👤 Submitted by Volunteer</h2>
                <p><strong>Name:</strong> ${donorData.name}</p>
                <p><strong>Roll Number:</strong> ${donorData.rollNumber}</p>
                <p><strong>Phone:</strong> ${donorData.phone}</p>
                <p><strong>Department:</strong> ${donorData.department} (${donorData.year})</p>
                <p><strong>District:</strong> ${donorData.district}</p>
              </div>
            `;
          }
        } catch (e) {
          console.log("Could not fetch donor info for email");
        }
      }

      // Send email notification with emergency details
      const emailSubject = `🚨 URGENT: Blood Donation Request - ${formData.bloodGroup} needed in ${formData.district}`

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background-color: #dc3545; color: white; padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
            <h1 style="margin: 0; font-size: 24px;">🚨 EMERGENCY BLOOD REQUEST</h1>
          </div>
          
          <div style="background-color: white; padding: 30px; border-radius: 0 0 8px 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #dc3545; margin-top: 0;">Emergency Details</h2>
            
            <div style="margin-bottom: 20px;">
              <h3 style="color: #333; margin-bottom: 10px;">Blood Group Required:</h3>
              <p style="background-color: #f8f9fa; padding: 10px; border-left: 4px solid #dc3545; margin: 0; font-size: 18px; font-weight: bold;">
                ${formData.bloodGroup}
              </p>
            </div>
            
            <div style="margin-bottom: 20px;">
              <h3 style="color: #333; margin-bottom: 10px;">Location:</h3>
              <p style="background-color: #f8f9fa; padding: 10px; border-left: 4px solid #007bff; margin: 0;">
                ${formData.district}
              </p>
            </div>
            
            <div style="margin-bottom: 20px;">
              <h3 style="color: #333; margin-bottom: 10px;">Urgency Level:</h3>
              <p style="background-color: ${formData.urgency === 'high' ? '#fff3cd' : formData.urgency === 'critical' ? '#f8d7da' : '#d1ecf1'}; 
                 padding: 10px; border-left: 4px solid ${formData.urgency === 'high' ? '#ffc107' : formData.urgency === 'critical' ? '#dc3545' : '#17a2b8'}; 
                 margin: 0; text-transform: uppercase; font-weight: bold;">
                ${formData.urgency}
              </p>
            </div>
            
            ${formData.description ? `
            <div style="margin-bottom: 20px;">
              <h3 style="color: #333; margin-bottom: 10px;">Description:</h3>
              <p style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 0; line-height: 1.5;">
                ${formData.description}
              </p>
            </div>
            ` : ''}
            
            <div style="margin-bottom: 20px;">
              <h3 style="color: #333; margin-bottom: 10px;">Contact Information:</h3>
              <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px;">
                <p style="margin: 5px 0;"><strong>Name:</strong> ${formData.contactName}</p>
                <p style="margin: 5px 0;"><strong>Phone:</strong> <a href="tel:${formData.contactPhone}" style="color: #007bff; text-decoration: none;">${formData.contactPhone}</a></p>
              </div>
            </div>

            ${userInfoText}
            
            <div style="background-color: #e9ecef; padding: 20px; border-radius: 4px; margin-top: 30px;">
              <h3 style="color: #495057; margin-top: 0;">⚠️ Important Notes:</h3>
              <ul style="color: #495057; margin: 0; padding-left: 20px;">
                <li>Please contact the requester directly using the phone number provided</li>
                <li>Verify your blood group compatibility before donating</li>
                <li>Ensure you meet all donation requirements</li>
                <li>This is an urgent request - please respond promptly if you can help</li>
              </ul>
            </div>
            
            <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
              <p style="color: #6c757d; margin: 0; font-size: 14px;">
                This email was sent from NSS BloodConnect Emergency System<br>
                <strong>Time:</strong> ${new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      `

      // Find compatible donors for background notifications
      const compatibleDonors = await searchDonors(formData.bloodGroup, formData.district)
      const donorEmails = compatibleDonors
        .filter(donor => donor.email && donor.isAvailable)
        .map(donor => donor.email)
        .filter(Boolean) as string[]

      setSuccess(true);

      // Background notifications task
      (async () => {
        try {
          // Send email notification to admin
          await sendEmail({
            to: ADMIN_EMAIL,
            subject: `🚨 public EMERGENCY: ${formData.bloodGroup} needed in ${formData.district}`,
            html: emailHtml,
            replyTo: formData.contactPhone,
          })

          // Send confirmation email to user if they are logged in
          if (userEmail) {
            await sendEmail({
              to: userEmail,
              subject: `Confirmation: Emergency Request Submitted - ${formData.bloodGroup}`,
              html: `
                <div style="font-family: Arial, sans-serif; padding: 20px;">
                  <h2 style="color: #28a745;">Request Received</h2>
                  <p>Your emergency blood request for <strong>${formData.bloodGroup}</strong> in <strong>${formData.district}</strong> has been received and processed.</p>
                  <p>Admins and compatible donors are being notified.</p>
                  <hr>
                  <p style="font-size: 12px; color: #666;">Thank you for using NSS BloodConnect.</p>
                </div>
              `
            })
          }

          // Send email notifications to compatible donors
          if (donorEmails.length > 0) {
            console.log(`📧 Sending background email notifications to ${donorEmails.length} donors`)
            await sendEmergencyNotifications({
              bloodGroup: formData.bloodGroup,
              district: formData.district,
              urgency: formData.urgency,
              description: formData.description,
              contactName: formData.contactName,
              contactPhone: formData.contactPhone,
              donorEmails: donorEmails,
            })
          }

          // Send WhatsApp notifications
          console.log(`📱 Sending background WhatsApp notifications...`)
          await sendBloodRequestWhatsAppNotifications({
            bloodGroup: formData.bloodGroup,
            district: formData.district,
            urgency: formData.urgency as any,
            description: formData.description,
            contactName: formData.contactName,
            contactPhone: formData.contactPhone,
          })

          // Send SMS notifications using Twilio via the server API
          const donorsWithPhones = compatibleDonors
            .filter(donor => donor.phone && donor.isAvailable)

          if (donorsWithPhones.length > 0) {
            console.log(`📱 Sending background SMS notifications to ${donorsWithPhones.length} donors via Twilio`)

            const smsBody = `🚨 NSS URGENT: ${formData.bloodGroup} needed at ${formData.district}. Priority: ${formData.urgency.toUpperCase()}. Contact ${formData.contactName}: ${formData.contactPhone}. Details: ${formData.description.substring(0, 50)}...`

            // Use server-side broadcast endpoint to avoid bundling native Node modules in the client
            try {
              const response = await fetch('/api/send-sms/broadcast', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  phoneNumbers: donorsWithPhones.map(d => d.phone),
                  message: smsBody
                })
              })

              const result = await response.json().catch(() => ({}))

              if (!response.ok) {
                console.error('SMS broadcast failed:', result.error || result)
              } else {
                console.log('SMS broadcast result:', result)
              }
            } catch (smsError) {
              console.error('SMS broadcast error:', smsError)
            }
          }
        } catch (notifierError) {
          console.error("Background notification error:", notifierError)
        }
      })()
    } catch (err: any) {
      setError(err.message || "Failed to create emergency request")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <>
        <Navbar />
        <main className="min-h-screen flex items-center justify-center py-12 px-4">
          <Card className="w-full max-w-md bg-green-50 border-green-200">
            <CardContent className="pt-6 text-center">
              <div className="text-5xl mb-4">✓</div>
              <h2 className="text-2xl font-bold text-green-800 mb-2">Request Submitted!</h2>
              <p className="text-green-700">
                Your emergency blood request has been posted. Available donors will be notified immediately.
              </p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button variant="default" onClick={resetForm}>Create Another</Button>
                <Button variant="outline" onClick={() => router.push("/dashboard")}>Go to Dashboard</Button>
              </div>
            </CardContent>
          </Card>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Navbar />
      <main className="min-h-screen py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-primary" />
                Emergency Blood Request
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div>
                  <label className="block text-sm font-medium mb-1">Blood Group Needed</label>
                  <select
                    name="bloodGroup"
                    value={formData.bloodGroup}
                    onChange={handleChange}
                    disabled={loading}
                    required
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                  >
                    <option value="">Select Blood Group</option>
                    {BLOOD_GROUPS.map((group) => (
                      <option key={group} value={group}>
                        {group}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">District</label>
                  <select
                    name="district"
                    value={formData.district}
                    onChange={handleChange}
                    disabled={loading}
                    required
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                  >
                    <option value="">Select District</option>
                    {DISTRICTS.map((district) => (
                      <option key={district} value={district}>
                        {district}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Urgency Level</label>
                  <select
                    name="urgency"
                    value={formData.urgency}
                    onChange={handleChange}
                    disabled={loading}
                    required
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Description</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    disabled={loading}
                    required
                    placeholder="Provide details about the emergency..."
                    className="w-full px-3 py-2 border border-input rounded-md bg-background text-foreground min-h-24"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Contact Name</label>
                  <Input
                    type="text"
                    name="contactName"
                    value={formData.contactName}
                    onChange={handleChange}
                    placeholder="Your name"
                    required
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Contact Phone</label>
                  <Input
                    type="tel"
                    name="contactPhone"
                    value={formData.contactPhone}
                    onChange={handleChange}
                    placeholder="+91 9876543210"
                    required
                    disabled={loading}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit Emergency Request"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </>
  )
}
