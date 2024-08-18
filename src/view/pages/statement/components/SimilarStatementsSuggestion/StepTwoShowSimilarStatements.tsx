import React from 'react';
import SendIcon from '@/assets/icons/send-icon-pointing-up-and-right.svg?react';
import SubmitStatementButton from './SubmitStatementButton';
import similarEyeIcon from '@/assets/icons/similarEyeIcon.svg';

interface SimilarStatementsSuggestionProps {
	setCurrentStep: React.Dispatch<React.SetStateAction<number>>;
	newStatementInput: { title: string; description: string };
	setViewSimilarStatement: React.Dispatch<
		React.SetStateAction<{
			title: string;
			description: string;
		}>
	>;
	similarStatements: { title: string; description: string }[];
}

export default function StepTwoShowSimilarStatements({
	setCurrentStep,
	newStatementInput,
	similarStatements,
	setViewSimilarStatement
}: SimilarStatementsSuggestionProps) {

	const handleViewSimilarStatement = (statement: {
		title: string;
		description: string;
	}) => {
		setViewSimilarStatement(statement);
		setCurrentStep(2);
	};

	const handleSubmit = () => {
		setCurrentStep((prev) => prev + 2);
	};

	return (
		<>
					<h4 className='similarities__title'>Compose your solution</h4>
			<div className='similarities__titleInput activeTitle'>
				<label
					htmlFor='titleInput'
				>Your statement title</label>
				<input
					type='text'
					id='titleInput'
					className={newStatementInput.title ? 'active' : ''}
					placeholder='Statement title. What people would see at first sight.'
					value={newStatementInput.title}
					disabled
				/>
			</div>
			<h4 className='alertText'>Here are several results that were found in the following topic:</h4>
			<section className='similarities__statementsBox'>
				{similarStatements.map((statement, index) => (
					<div
						key={index}
						className='similarities__statementsBox__similarStatement'
						onClick={() => handleViewSimilarStatement(statement)}
					>
						<p className='similarities__statementsBox__statementTitle'>{statement.title}</p>
						<p className='similarities__statementsBox__statementDescription'>{statement.description}</p>
						<img className='similarities__statementsBox__similarEyeIcon' src={similarEyeIcon}  alt="Similar Eye Icon" />
						<hr />
					</div>
				))}
			</section>

			<div className='twoButtonBox'>
				<SubmitStatementButton
					icon={SendIcon}
					text='Continue compose solution'
					buttonMaxWidth="14.5rem"
					textColor='var(--white)'
					onClick={handleSubmit}
				/>
			</div>
		</>
	);
}

