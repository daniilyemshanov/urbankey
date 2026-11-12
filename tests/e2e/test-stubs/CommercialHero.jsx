import { useContext } from "react";
import { MyContext } from "/src/Context.jsx";
export default function CommercialHero() { const { commercialPage } = useContext(MyContext); return <div data-testid="detail">{commercialPage?.title?.ru}</div>; }
