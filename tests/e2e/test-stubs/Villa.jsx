import { useContext } from "react";
import { MyContext } from "/src/Context.jsx";
export default function Villa() { const { villa } = useContext(MyContext); return <div data-testid="detail">{villa?.title?.ru}</div>; }
