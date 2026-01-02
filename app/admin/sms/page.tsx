"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { CheckCircle, XCircle, Loader2, Smartphone, MessageSquare, Send, Users, AlertCircle } from "lucide-react"
import { AdminSidebar } from "@/components/admin-sidebar"
import { db } from "@/lib/firebase"
import { collection, getDocs } from "firebase/firestore"

export default function AdminSMSPage() {
    const router = useRouter()
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [donorCount, setDonorCount] = useState(0)
    const [donorsWithPhones, setDonorsWithPhones] = useState<any[]>([])
    const [filteredDonors, setFilteredDonors] = useState<any[]>([])
    const [selectedDistrict, setSelectedDistrict] = useState("all")
    const [broadcastMessage, setBroadcastMessage] = useState("")

    const [config, setConfig] = useState({
        accountSid: false,
        authToken: false,
        phoneNumber: false
    })
    const [sandboxUrl, setSandboxUrl] = useState<string>("")

    useEffect(() => {
        // Check admin session
        const adminSession = localStorage.getItem("adminSession")
        if (!adminSession) {
            router.push("/admin/login")
            return
        }

        fetchStats()
        const saved = localStorage.getItem('twilioWhatsAppSandbox')
        if (saved) setSandboxUrl(saved)
    }, [])

    const fetchStats = async () => {
        setLoading(true)
        try {
            // Fetch donors from Firebase
            const donorsCol = collection(db, "donors")
            const donorSnapshot = await getDocs(donorsCol)
            const donorList = donorSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

            const withPhones = donorList.filter((d: any) => d.phone)
            setDonorCount(donorList.length)
            setDonorsWithPhones(withPhones)
            setFilteredDonors(withPhones)

            // We can't check server-side env vars directly from client, 
            // but we can imply based on an API check if we wanted.
            // For now, let's just assume configuration if the user is here 
            // or add a simple check API.
            const response = await fetch('/api/admin/sms-config')
            const configData = await response.json()
            setConfig(configData)

        } catch (err: any) {
            console.error("Error fetching SMS stats:", err)
            setError("Failed to load donor statistics")
        } finally {
            setLoading(false)
        }
    }

    const handleDistrictChange = (value: string) => {
        setSelectedDistrict(value)
        if (value === "all") {
            setFilteredDonors(donorsWithPhones)
        } else {
            setFilteredDonors(donorsWithPhones.filter(d => d.district === value))
        }
    }

    const DISTRICTS = [
        "Adilabad", "Bhadradri Kothagudem", "Hyderabad", "Jagtial", "Jangaon",
        "Jayashankar Bhupalpally", "Jogulamba Gadwal", "Kamareddy", "Karimnagar",
        "Khammam", "Komaram Bheem Asifabad", "Mahabubabad", "Mahabubnagar",
        "Mancherial", "Medak", "Medchal-Malkajgiri", "Mulugu", "Nagarkurnool",
        "Nalgonda", "Narayanpet", "Nirmal", "Nizamabad", "Peddapalli",
        "Rajanna Sircilla", "Rangareddy", "Sangareddy", "Siddipet", "Suryapet",
        "Vikarabad", "Wanaparthy", "Warangal Urban", "Warangal Rural", "Yadadri Bhuvanagiri"
    ]

    const handleBroadcast = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!broadcastMessage.trim()) {
            setError("Please enter a message")
            return
        }

        if (filteredDonors.length === 0) {
            setError("No donors found in the selected category")
            return
        }

        if (!confirm(`Are you sure you want to send this SMS to ${filteredDonors.length} donors in ${selectedDistrict === 'all' ? 'all districts' : selectedDistrict}?`)) {
            return
        }

        setSending(true)
        setError(null)
        setSuccess(null)

        try {
            const phones = filteredDonors.map(d => d.phone)

            const response = await fetch('/api/send-sms/broadcast', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phoneNumbers: phones,
                    message: broadcastMessage
                })
            })

            const result = await response.json()

            if (result.success) {
                setSuccess(`Successfully sent SMS to ${result.results.success} donors! (${result.results.failed} failed)`)
                setBroadcastMessage("")
            } else {
                throw new Error(result.error || "Failed to send broadcast")
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSending(false)
        }
    }

    return (
        <div className="flex h-screen">
            <AdminSidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="border-b border-border bg-background px-6 py-4">
                    <h1 className="text-2xl font-bold">SMS Notifications</h1>
                </header>

                <main className="flex-1 overflow-auto p-6 text-foreground">
                    <div className="max-w-4xl mx-auto space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Configuration Status */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Smartphone className="h-5 w-5" />
                                        Twilio Status
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between p-3 bg-muted rounded-md text-foreground">
                                            <span className="font-medium">Account SID:</span>
                                            {config.accountSid ? (
                                                <CheckCircle className="h-5 w-5 text-green-600" />
                                            ) : (
                                                <XCircle className="h-5 w-5 text-red-600" />
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-muted rounded-md text-foreground">
                                            <span className="font-medium">Auth Token:</span>
                                            {config.authToken ? (
                                                <CheckCircle className="h-5 w-5 text-green-600" />
                                            ) : (
                                                <XCircle className="h-5 w-5 text-red-600" />
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between p-3 bg-muted rounded-md text-foreground">
                                            <span className="font-medium">Twilio Phone Number:</span>
                                            {config.phoneNumber ? (
                                                <CheckCircle className="h-5 w-5 text-green-600" />
                                            ) : (
                                                <XCircle className="h-5 w-5 text-red-600" />
                                            )}
                                        </div>
                                    </div>
                                    {!config.accountSid || !config.authToken || !config.phoneNumber ? (
                                        <Alert variant="destructive">
                                            <AlertCircle className="h-4 w-4" />
                                            <AlertDescription>
                                                Twilio is not fully configured. Please update your environment variables.
                                            </AlertDescription>
                                        </Alert>
                                    ) : (
                                        <Alert className="bg-green-50 border-green-200">
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                            <AlertDescription className="text-green-800">
                                                Twilio is connected and ready to send SMS.
                                            </AlertDescription>
                                        </Alert>
                                    )}
                                </CardContent>
                            </Card>

                            {/* Twilio WhatsApp Sandbox */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <MessageSquare className="h-5 w-5" />
                                        WhatsApp Sandbox
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <p className="text-sm text-muted-foreground">Suggested webhook URL (set this in Twilio):</p>
                                    <div className="flex gap-2">
                                        <Input readOnly value={`${typeof window !== 'undefined' ? window.location.origin : ''}/api/whatsfrom`} />
                                        <Button onClick={async () => {
                                            try {
                                                const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/whatsfrom`
                                                await navigator.clipboard.writeText(url)
                                                alert('Copied suggested webhook to clipboard')
                                            } catch (e) {
                                                console.error(e)
                                                alert('Failed to copy')
                                            }
                                        }}>Copy</Button>
                                    </div>

                                    <p className="text-sm text-muted-foreground">Your Twilio sandbox webhook URL (optional):</p>
                                    <div className="flex gap-2">
                                        <Input placeholder="https://your-sandbox.twil.io/demo-reply" value={sandboxUrl} onChange={(e) => setSandboxUrl(e.target.value)} />
                                        <Button onClick={() => {
                                            localStorage.setItem('twilioWhatsAppSandbox', sandboxUrl)
                                            alert('Saved sandbox URL locally')
                                        }}>Save</Button>
                                    </div>
                                    <p className="text-xs text-muted-foreground">Example sandbox: https://timberwolf-mastiff-9776.twil.io/demo-reply</p>
                                </CardContent>
                            </Card>

                            {/* Donor Stats */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Users className="h-5 w-5" />
                                        Donor Reach
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex flex-col items-center justify-center p-6 space-y-2">
                                        <span className="text-4xl font-bold">{filteredDonors.length}</span>
                                        <span className="text-muted-foreground">Donors in {selectedDistrict === 'all' ? 'All Districts' : selectedDistrict}</span>
                                        <div className="w-full bg-muted rounded-full h-2.5 mt-4">
                                            <div
                                                className="bg-primary h-2.5 rounded-full transition-all duration-500"
                                                style={{ width: `${donorsWithPhones.length > 0 ? (filteredDonors.length / donorsWithPhones.length) * 100 : 0}%` }}
                                            ></div>
                                        </div>
                                        <span className="text-xs text-muted-foreground mt-1">
                                            {donorsWithPhones.length} Donors with Phone Numbers
                                        </span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Broadcast Form */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Send className="h-5 w-5" />
                                    Broadcast SMS by District
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <form onSubmit={handleBroadcast} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Select District</label>
                                        <select
                                            className="w-full p-2 rounded-md border border-input bg-background"
                                            value={selectedDistrict}
                                            onChange={(e) => handleDistrictChange(e.target.value)}
                                            disabled={sending || loading}
                                        >
                                            <option value="all">All Districts</option>
                                            {DISTRICTS.map(d => (
                                                <option key={d} value={d}>{d}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {error && (
                                        <Alert variant="destructive">
                                            <XCircle className="h-4 w-4" />
                                            <AlertDescription>{error}</AlertDescription>
                                        </Alert>
                                    )}
                                    {success && (
                                        <Alert className="bg-green-50 border-green-200">
                                            <CheckCircle className="h-4 w-4 text-green-600" />
                                            <AlertDescription className="text-green-800">{success}</AlertDescription>
                                        </Alert>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Message Content</label>
                                        <Textarea
                                            placeholder="Enter the message for all donors..."
                                            className="min-h-[120px]"
                                            value={broadcastMessage}
                                            onChange={(e) => setBroadcastMessage(e.target.value)}
                                            disabled={sending || loading}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            Keep it under 160 characters to avoid multiple segment charges.
                                            Current length: {broadcastMessage.length}
                                        </p>
                                    </div>

                                    <Button
                                        type="submit"
                                        className="w-full"
                                        disabled={sending || loading || filteredDonors.length === 0}
                                    >
                                        {sending ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Sending Broadcast...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="mr-2 h-4 w-4" />
                                                Send Broadcast to {filteredDonors.length} Donors in {selectedDistrict === 'all' ? 'all districts' : selectedDistrict}
                                            </>
                                        )}
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Usage Guidelines</CardTitle>
                            </CardHeader>
                            <CardContent className="prose prose-sm max-w-none text-muted-foreground">
                                <ul className="list-disc list-inside space-y-2">
                                    <li>Use broadcasts only for urgent system-wide announcements or critical donor needs.</li>
                                    <li>SMS messages are charged per segment (160 characters).</li>
                                    <li>Avoid sending frequent messages to prevent donors from opting out.</li>
                                    <li>The broadcast will attempt to send to all donors who have a registered mobile number.</li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>
        </div>
    )
}
