import { Button } from "@/components/ui/button"
import { Link, Navigate } from "react-router-dom"
import { useAuth } from "@/hooks/use-auth"

const Home = () => {
    const { user } = useAuth()

    if (user) return <Navigate to="/user/conversations" replace />

    return (
        <div className="h-full overflow-hidden flex flex-col">
            <div className="flex-1 flex flex-col space-y-8 items-center justify-center">
                {/* title */}
                <div className="text-center">
                    <h1 className="font-bold text-6xl lg:text-8xl">Conversa</h1>
                    <p className="text-xl">Online Chatting App</p>
                </div>
                {/* action buttons */}
                <div className="flex flex-col items-center gap-4">
                    <div className="flex items-center gap-2">
                        <Link to="/login">
                            <Button className="p-4 lg:p-6 text-base lg:text-xl" size={"lg"} variant={"secondary"}>
                                Login
                            </Button>
                        </Link>
                        <Link to="/apply">
                            <Button size={"lg"} className="p-4 lg:p-6 text-base lg:text-xl bg-primary/90 hover:bg-primary">
                                Apply for Membership
                            </Button>
                        </Link>
                    </div>
                    <Link to="/activate" className="text-sm underline underline-offset-4 text-muted-foreground hover:text-foreground transition-colors">
                        Already approved? Activate Membership
                    </Link>
                </div>
            </div>

        </div>
    )
}

export default Home