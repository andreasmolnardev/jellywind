interface Props {
    isRow: boolean;
    children: React.ReactNode;
}

export default function Center({ isRow, children }: Props) {
    return (
        <div
            className={`flex items-center justify-center ${isRow ? 'flex-row' : 'flex-col'}`}
        >
            {children}
        </div>
    );
}
