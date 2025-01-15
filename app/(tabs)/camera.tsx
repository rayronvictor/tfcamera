import {FlatList, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {Link} from "expo-router";

type ItemData = {
  title: string;
  path: string;
};

const DATA: ItemData[] = [
  {
    title: 'Classifier',
    path: '/camera-classifier',
  },
  {
    title: 'Segmentation',
    path: '/camera-segmentation',
  },
];

export default function CameraListScreen() {
  return (
    <FlatList
      data={DATA}
      renderItem={({item}) => <Item item={item} />}
      keyExtractor={item => item.path}
    />
  );
}

type ItemProps = {
  item: ItemData;
};

const Item = ({item}: ItemProps) => (
  <Link href={item.path} asChild>
    <TouchableOpacity style={styles.item}>
      <Text style={styles.title}>{item.title}</Text>
    </TouchableOpacity>
  </Link>
);

const styles = StyleSheet.create({
  item: {
    backgroundColor: '#f9c2ff',
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  title: {
    fontSize: 32,
  },
});
