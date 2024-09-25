import { FC, useEffect, useState, useRef } from "react";

// Third Party Imports
import { Statement, User } from "delib-npm";

// Custom Components
import ChatMessageCard from "./components/chatMessageCard/ChatMessageCard";
import StatementInput from "./components/input/StatementInput";
import useSlideAndSubStatement from "../../../../../controllers/hooks/useSlideAndSubStatement";

import NewMessages from "./components/newMessages/NewMessages";
import { useAppSelector } from "@/controllers/hooks/reduxHooks";
import { userSelector } from "@/model/users/userSlice";
import "./StatementChat.scss";
import { useLocation } from "react-router-dom";

interface Props {
	statement: Statement;
	subStatements: Statement[];
	handleShowTalker: (statement: User | null) => void;
	setShowAskPermission: React.Dispatch<React.SetStateAction<boolean>>;

}

let firstTime = true;
let numberOfSubStatements = 0;

const StatementChat: FC<Props> = ({
	statement,
	subStatements,
	handleShowTalker,
	
}) => {
	const user = useAppSelector(userSelector);
	const messagesEndRef = useRef(null);
	const location = useLocation();

	const [newMessages, setNewMessages] = useState<number>(0);

	const { toSlide, slideInOrOut } = useSlideAndSubStatement(
		statement.parentId,
	);

	function scrollToHash() {
		console.log("scrollToHash");
		if (location.hash) {
			const element = document.querySelector(location.hash);
			console.log(element?"element exists":`element ${ location.hash} does not exist`);
			if (element) {
				element.scrollIntoView();
				firstTime = false;
				return
			}
		}
		
	}

	//scroll to bottom
	const scrollToBottom = () => {
	console.log("scrollToBottom");
		if (!messagesEndRef) return;
		if (!messagesEndRef.current) return;
		if(location.hash) return;
		if (firstTime) {
			//@ts-ignore
			messagesEndRef.current.scrollIntoView({ behavior: "auto" });
			firstTime = false;
		} else {
			//@ts-ignore
			messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
		}
	};

	useEffect(() => {
		firstTime = true;
		console.log("staring at...... ",location.hash);
	}, []);

	//effects
	useEffect(() => {
		console.log("subStatements changed");
		if(!firstTime) return;
		console.log("location.hash:", location.hash);
		if(location.hash) {scrollToHash();}
		else {scrollToBottom();}
	}, [subStatements]);

	useEffect(() => {
		//if new sub-statement was not created by the user, then set newMessages to the number of new subStatements
		const lastMessage = subStatements[subStatements.length - 1];
		if (lastMessage?.creatorId !== user?.uid) {
			const isNewMessages =
				subStatements.length - numberOfSubStatements > 0 ? true : false;
			numberOfSubStatements = subStatements.length;
			if (isNewMessages) {
				setNewMessages((nmbr) => nmbr + 1);
			}
		} else {
			scrollToBottom();
		}
	}, [subStatements]);


	return (
		<>
			<div
				className={`page__main statement-chat ${toSlide && slideInOrOut}`}
				id={`msg-${statement.statementId}`}
			>
				{subStatements?.map((statementSub: Statement, index) => (
					<div key={statementSub.statementId}>
						<ChatMessageCard
							parentStatement={statement}
							statement={statementSub}
							showImage={handleShowTalker}
							index={index}
							previousStatement={subStatements[index - 1]}
						/>
					</div>
				))}
				<div ref={messagesEndRef} />
			</div>
			<div className="page__footer">
				<NewMessages
					newMessages={newMessages}
					setNewMessages={setNewMessages}
					scrollToBottom={scrollToBottom}
				/>
				{statement && (
					<StatementInput
						statement={statement}
					/>
				)}
			</div>
		</>
	)

};

export default StatementChat;
